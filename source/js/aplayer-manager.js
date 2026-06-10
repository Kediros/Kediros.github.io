/**
 * APlayer 播放器管理器
 * 功能：
 * 1. 播放状态持久化（localStorage 保存当前歌曲、播放进度、播放模式）
 * 2. 页面刷新/跳转后恢复播放状态
 * 3. Pjax 跳转时保持播放不中断（解决 Meting 重新创建实例导致音乐停止的问题）
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
   * 修补 loadMeting 函数，使其跳过带有 .no-destroy 类的固定播放器
   * 这样 Pjax 导航时 Meting 不会销毁和重建固定播放器，音乐不会中断
   *
   * 原理：
   * Meting.js 的 loadMeting() 会：
   * 1. 遍历内部局部 aplayers 数组，调用 destroy() 销毁所有实例
   * 2. 清空内部数组
   * 3. 查询 DOM 中所有 .aplayer 元素（返回静态 NodeList 快照）
   * 4. 遍历 NodeList，对每个元素发起 XHR 请求获取歌曲数据
   * 5. XHR 完成后创建新 APlayer 实例（异步）
   *
   * 修补策略：
   * - Patch 受保护播放器的 destroy 方法为空操作，防止 Meting 通过内部数组销毁它
   * - 从 window.aplayers 中临时移除受保护播放器，防止新实例的 mutex 暂停它
   * - 清空受保护容器上的 data-id 和 data-url 属性，这样即使 Meting 的 NodeList
   *   中包含了该容器，也会因为缺少 data-id/data-url 而跳过处理（不会创建新实例）
   * - 调用原始 loadMeting 后，恢复所有属性和方法
   */
  function patchLoadMeting () {
    if (typeof window.loadMeting !== 'function') {
      // 如果 loadMeting 还没加载完成，等待它
      // 因为 aplayer-manager.js 在 head 中加载，而 Meting.js 在 body 底部加载
      var checkMeting = setInterval(function () {
        if (typeof window.loadMeting === 'function') {
          clearInterval(checkMeting)
          doPatchLoadMeting()
        }
      }, 100)
      // 30秒超时停止检查
      setTimeout(function () { clearInterval(checkMeting) }, 30000)
      return
    }
    doPatchLoadMeting()
  }

  /**
   * 执行实际的 loadMeting 修补
   */
  function doPatchLoadMeting () {
    var originalLoadMeting = window.loadMeting

    window.loadMeting = function () {
      // ---- 步骤1: 收集受保护的播放器及其容器 ----
      var protectedPlayers = []
      var protectedContainers = []

      // 从 window.aplayers 中找出受保护的播放器实例
      var aplayers = window.aplayers
      if (aplayers && aplayers.length > 0) {
        for (var i = 0; i < aplayers.length; i++) {
          var p = aplayers[i]
          if (p.container && p.container.classList && p.container.classList.contains('no-destroy')) {
            protectedPlayers.push(p)
          }
        }
      }

      // 从 DOM 中找出受保护的容器
      var containers = document.querySelectorAll('.aplayer.no-destroy')
      for (var i = 0; i < containers.length; i++) {
        protectedContainers.push(containers[i])
      }

      // ---- 步骤2: Patch destroy 方法为空操作 ----
      var originalDestroyMap = []
      for (var i = 0; i < protectedPlayers.length; i++) {
        var p = protectedPlayers[i]
        if (p.destroy) {
          originalDestroyMap.push({ player: p, destroy: p.destroy })
          p.destroy = function () {
            // 空操作：不销毁固定播放器，保持音频播放
          }
        }
      }

      // ---- 步骤3: 从 window.aplayers 中临时移除受保护播放器 ----
      // 防止新实例的 mutex 机制暂停它们
      if (window.aplayers && protectedPlayers.length > 0) {
        for (var i = 0; i < protectedPlayers.length; i++) {
          var idx = window.aplayers.indexOf(protectedPlayers[i])
          if (idx !== -1) {
            window.aplayers.splice(idx, 1)
          }
        }
      }

      // ---- 步骤4: 保存并清空受保护容器的 data-id 和 data-url ----
      var originalDataAttrs = []
      for (var i = 0; i < protectedContainers.length; i++) {
        var el = protectedContainers[i]
        originalDataAttrs.push({
          el: el,
          id: el.dataset.id,
          url: el.dataset.url
        })
        // 清空 data-id 和 data-url，让 Meting 跳过这个容器
        delete el.dataset.id
        delete el.dataset.url
      }

      // ---- 步骤5: 调用原始 loadMeting ----
      originalLoadMeting()

      // ---- 步骤6: 恢复受保护容器的 data-id 和 data-url ----
      for (var i = 0; i < originalDataAttrs.length; i++) {
        var item = originalDataAttrs[i]
        if (item.id !== undefined) {
          item.el.dataset.id = item.id
        }
        if (item.url !== undefined) {
          item.el.dataset.url = item.url
        }
      }

      // ---- 步骤7: 恢复 destroy 方法 ----
      for (var i = 0; i < originalDestroyMap.length; i++) {
        originalDestroyMap[i].player.destroy = originalDestroyMap[i].destroy
      }

      // ---- 步骤8: 将受保护播放器恢复回 window.aplayers ----
      if (window.aplayers) {
        for (var i = 0; i < protectedPlayers.length; i++) {
          var p = protectedPlayers[i]
          if (window.aplayers.indexOf(p) === -1) {
            window.aplayers.push(p)
          }
        }
      }

      // ---- 步骤9: 如果播放器被暂停，恢复播放 ----
      for (var i = 0; i < protectedPlayers.length; i++) {
        var p = protectedPlayers[i]
        if (p.paused) {
          var savedState = getSavedState()
          if (savedState) {
            if (savedState.volume !== undefined && p.audio) {
              p.volume(savedState.volume, true)
            }
            // 延迟恢复，等待页面完全加载
            setTimeout(function () {
              try {
                if (savedState.currentTime > 0) {
                  p.seek(savedState.currentTime)
                }
                p.play()
              } catch (e) { /* ignore */ }
            }, 800)
          }
        }
      }
    }
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

    // 修补 loadMeting，保护固定播放器
    patchLoadMeting()

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

  /**
   * Pjax 完成后处理函数
   * 1. 重新创建歌词元素（Pjax 会替换 body 内容）
   * 2. 重新绑定播放器事件
   * 3. 重新初始化歌词同步
   * 4. 恢复播放状态（如果播放器被意外暂停）
   */
  function onPjaxComplete () {
    createLrcElement()
    adjustLrcPosition()

    const players = window.aplayers
    if (players && players.length > 0) {
      // 找到固定播放器（受保护的）
      for (let i = 0; i < players.length; i++) {
        const player = players[i]
        if (player.options.fixed || (player.container && player.container.classList.contains('no-destroy'))) {
          bindPlayerEvents(player)
          initLrcSync()

          // 如果播放器被暂停，尝试恢复
          if (player.paused) {
            const savedState = getSavedState()
            if (savedState) {
              setTimeout(function () {
                try {
                  if (savedState.currentTime > 0) {
                    player.seek(savedState.currentTime)
                  }
                  player.play()
                } catch (e) { /* ignore */ }
              }, 500)
            }
          }
          break
        }
      }
    }
  }

  // Pjax 完成后重新初始化
  document.addEventListener('pjax:complete', onPjaxComplete)

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
