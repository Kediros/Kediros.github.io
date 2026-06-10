/**
 * APlayer 播放器管理器
 * 功能：
 * 1. 播放状态持久化（localStorage 保存当前歌曲、播放进度、播放模式）
 * 2. 页面刷新/跳转后恢复播放状态
 * 3. Pjax 跳转时保持播放不中断
 * 4. 歌词自适应分辨率
 * 5. 歌词独立显示在页面中央底部
 */

(function () {
  'use strict'

  const STORAGE_KEY = 'aplayer-state'
  const LRC_STORAGE_KEY = 'aplayer-lrc-state'

  /**
   * 保存播放器状态到 localStorage
   */
  function savePlayerState (player) {
    if (!player) return
    try {
      const state = {
        currentIndex: player.list ? player.list.index : (player.audio ? player.audio.currentIndex : 0),
        currentTime: player.audio ? player.audio.currentTime : 0,
        volume: player.audio ? player.audio.volume : 1,
        order: player.options.order || 'list',
        loop: player.options.loop || 'all',
        theme: document.documentElement.getAttribute('data-theme') || 'light'
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      // ignore
    }
  }

  /**
   * 获取保存的播放器状态
   */
  function getSavedState () {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  }

  /**
   * 清除保存的播放器状态
   */
  function clearSavedState () {
    localStorage.removeItem(STORAGE_KEY)
  }

  /**
   * 保存歌词显示状态
   */
  function saveLrcState (isVisible) {
    try {
      localStorage.setItem(LRC_STORAGE_KEY, JSON.stringify({ visible: isVisible }))
    } catch (e) {
      // ignore
    }
  }

  /**
   * 获取歌词显示状态
   */
  function getLrcState () {
    try {
      const data = localStorage.getItem(LRC_STORAGE_KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  }

  /**
   * 自适应歌词位置和大小
   */
  function adjustLrcPosition () {
    const lrcEl = document.getElementById('custom-lrc')
    if (!lrcEl) return

    const width = window.innerWidth
    const height = window.innerHeight

    // 根据屏幕宽度调整字体大小
    let fontSize, bottomOffset

    if (width < 480) {
      // 手机小屏
      fontSize = '14px'
      bottomOffset = '60px'
    } else if (width < 768) {
      // 手机大屏/小平板
      fontSize = '16px'
      bottomOffset = '50px'
    } else if (width < 1024) {
      // 平板
      fontSize = '18px'
      bottomOffset = '40px'
    } else {
      // 桌面
      fontSize = '20px'
      bottomOffset = '40px'
    }

    // 根据屏幕高度微调
    if (height < 600) {
      bottomOffset = '30px'
      fontSize = parseInt(fontSize) - 2 + 'px'
    }

    lrcEl.style.fontSize = fontSize
    lrcEl.style.bottom = bottomOffset

    // 调整歌词容器宽度
    if (width < 480) {
      lrcEl.style.width = '95%'
      lrcEl.style.maxWidth = '95%'
    } else {
      lrcEl.style.width = '90%'
      lrcEl.style.maxWidth = '600px'
    }
  }

  /**
   * 创建独立的歌词显示元素
   */
  function createLrcElement () {
    if (document.getElementById('custom-lrc')) return

    const lrcEl = document.createElement('div')
    lrcEl.id = 'custom-lrc'
    lrcEl.className = 'aplayer-lrc-custom'
    // 初始样式由 CSS 控制
    document.body.appendChild(lrcEl)
    adjustLrcPosition()
  }

  /**
   * 同步歌词到独立显示元素
   */
  function syncLrc () {
    const lrcBox = document.querySelector('.aplayer-lrc')
    const customLrc = document.getElementById('custom-lrc')
    if (!lrcBox || !customLrc) return

    // 同步歌词内容
    customLrc.innerHTML = lrcBox.innerHTML

    // 同步歌词高亮状态
    const activeLrc = lrcBox.querySelector('.aplayer-lrc-current')
    if (activeLrc) {
      const customLrcItems = customLrc.querySelectorAll('.aplayer-lrc-contents p')
      const activeIndex = Array.from(lrcBox.querySelectorAll('.aplayer-lrc-contents p')).indexOf(activeLrc)
      if (activeIndex >= 0 && customLrcItems[activeIndex]) {
        customLrcItems.forEach(p => p.classList.remove('aplayer-lrc-current'))
        customLrcItems[activeIndex].classList.add('aplayer-lrc-current')
      }
    }
  }

  /**
   * 恢复播放器状态
   */
  function restorePlayerState (player) {
    const savedState = getSavedState()
    if (!savedState || !player) return

    try {
      // 恢复音量
      if (savedState.volume !== undefined && player.audio) {
        player.volume(savedState.volume, true)
      }

      // 恢复播放模式
      if (savedState.order && player.options) {
        player.options.order = savedState.order
      }
      if (savedState.loop && player.options) {
        player.options.loop = savedState.loop
      }

      // 恢复当前歌曲索引
      if (savedState.currentIndex !== undefined && player.list && player.list.index !== savedState.currentIndex) {
        // 延迟切换歌曲，等待播放器完全初始化
        setTimeout(function () {
          try {
            player.list.switch(savedState.currentIndex)
            // 恢复播放进度
            if (savedState.currentTime > 0) {
              setTimeout(function () {
                try {
                  player.seek(savedState.currentTime)
                } catch (e) { /* ignore */ }
              }, 500)
            }
            // 自动播放
            player.play()
          } catch (e) { /* ignore */ }
        }, 1000)
      } else if (savedState.currentTime > 0) {
        // 同一首歌，直接恢复进度
        setTimeout(function () {
          try {
            player.seek(savedState.currentTime)
          } catch (e) { /* ignore */ }
        }, 1000)
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 绑定播放器事件以保存状态
   */
  function bindPlayerEvents (player) {
    if (!player) return

    // 歌曲切换时保存状态
    const origSwitch = player.list.switch
    if (origSwitch) {
      player.list.switch = function (index) {
        origSwitch.call(player.list, index)
        setTimeout(function () { savePlayerState(player) }, 100)
      }
    }

    // 定时保存播放进度
    let saveTimer = null
    const startSaveTimer = function () {
      if (saveTimer) clearInterval(saveTimer)
      saveTimer = setInterval(function () {
        savePlayerState(player)
      }, 3000)
    }

    // 监听播放事件
    const origPlay = player.play
    if (origPlay) {
      player.play = function () {
        origPlay.call(player)
        startSaveTimer()
      }
    }

    const origPause = player.pause
    if (origPause) {
      player.pause = function () {
        origPause.call(player)
        if (saveTimer) {
          clearInterval(saveTimer)
          saveTimer = null
        }
        savePlayerState(player)
      }
    }

    // 监听 APlayer 原生事件
    player.on('play', function () {
      startSaveTimer()
    })

    player.on('pause', function () {
      if (saveTimer) {
        clearInterval(saveTimer)
        saveTimer = null
      }
      savePlayerState(player)
    })

    player.on('error', function () {
      // 出错时不清除状态，以便恢复
    })
  }

  /**
   * 初始化歌词同步
   */
  function initLrcSync () {
    const lrcBox = document.querySelector('.aplayer-lrc')
    const customLrc = document.getElementById('custom-lrc')
    if (!lrcBox || !customLrc) return

    // 立即同步一次
    syncLrc()

    // 使用 MutationObserver 监听歌词变化
    const observer = new MutationObserver(function () {
      syncLrc()
    })

    observer.observe(lrcBox, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    })

    // 同时也用定时器作为后备
    setInterval(syncLrc, 200)
  }

  /**
   * 主初始化函数
   */
  function init () {
    // 创建独立歌词显示元素
    createLrcElement()

    // 监听窗口大小变化，自适应歌词
    window.addEventListener('resize', function () {
      adjustLrcPosition()
    })

    // 监听 APlayer 创建完成
    const checkPlayer = setInterval(function () {
      const players = window.aplayers
      if (players && players.length > 0) {
        clearInterval(checkPlayer)
        const player = players[0]

        // 绑定事件保存状态
        bindPlayerEvents(player)

        // 恢复播放状态
        restorePlayerState(player)

        // 初始化歌词同步
        initLrcSync()

        // 歌词显示状态恢复
        const lrcState = getLrcState()
        if (lrcState && !lrcState.visible) {
          const customLrc = document.getElementById('custom-lrc')
          if (customLrc) customLrc.style.display = 'none'
        }
      }
    }, 500)

    // 超时停止检查
    setTimeout(function () {
      clearInterval(checkPlayer)
    }, 15000)
  }

  // 页面加载完成后初始化
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init()
  } else {
    document.addEventListener('DOMContentLoaded', init)
  }

  // Pjax 完成后重新初始化歌词同步
  document.addEventListener('pjax:complete', function () {
    createLrcElement()
    adjustLrcPosition()

    const players = window.aplayers
    if (players && players.length > 0) {
      const player = players[0]
      bindPlayerEvents(player)
      initLrcSync()
    }
  })

  // 页面可见性变化时保存状态（用户切换标签页时）
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      const players = window.aplayers
      if (players && players.length > 0) {
        savePlayerState(players[0])
      }
    }
  })

  // 页面关闭/刷新前保存状态
  window.addEventListener('beforeunload', function () {
    const players = window.aplayers
    if (players && players.length > 0) {
      savePlayerState(players[0])
    }
  })
})()
