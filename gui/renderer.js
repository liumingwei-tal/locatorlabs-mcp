const { ipcRenderer } = require('electron');

// DOM元素
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const statusText = document.getElementById('statusText');
const pageTitle = document.getElementById('pageTitle');
const errorMessage = document.getElementById('errorMessage');
const tabsContainer = document.getElementById('tabsContainer');
const browserContainer = document.getElementById('browserContainer');
const newTabBtn = document.getElementById('newTabBtn');

// 标签页管理
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

// 格式化URL
function formatUrl(url) {
  if (!url) return '';
  
  url = url.trim();
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  if (url.includes('.')) {
    return `https://${url}`;
  }
  
  return `https://www.baidu.com/search?q=${encodeURIComponent(url)}`;
}

// 创建新标签页
function createTab(url = 'https://www.baidu.com', title = '新标签页') {
  const tabId = `tab-${++tabIdCounter}`;
  
  // 创建标签页DOM
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.tabId = tabId;
  
  const tabTitle = document.createElement('span');
  tabTitle.className = 'tab-title';
  tabTitle.textContent = title;
  
  const tabClose = document.createElement('button');
  tabClose.className = 'tab-close';
  tabClose.innerHTML = '×';
  tabClose.title = '关闭标签页';
  
  const tabLoading = document.createElement('div');
  tabLoading.className = 'tab-loading';
  tabLoading.style.display = 'none';
  
  tab.appendChild(tabLoading);
  tab.appendChild(tabTitle);
  tab.appendChild(tabClose);
  
  // 创建webview容器
  const webviewContainer = document.createElement('div');
  webviewContainer.className = 'webview-container';
  webviewContainer.dataset.tabId = tabId;
  
  const webview = document.createElement('webview');
  webview.className = 'webview';
  webview.setAttribute('allowpopups', 'true'); // 允许弹窗事件，但会在new-window事件中拦截
  webview.setAttribute('webpreferences', 'nodeIntegration=yes,contextIsolation=no,webSecurity=yes,allowRunningInsecureContent=no');
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.margin = '0';
  webview.style.padding = '0';
  webview.style.border = 'none';
  webview.style.position = 'absolute';
  webview.style.top = '0';
  webview.style.left = '0';
  webview.style.right = '0';
  webview.style.bottom = '0';
  webview.src = url;
  
  // 确保webview尺寸正确 - 使用更可靠的方法
  function setWebviewSize() {
    const rect = browserContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      webviewContainer.style.width = rect.width + 'px';
      webviewContainer.style.height = rect.height + 'px';
      webview.style.width = rect.width + 'px';
      webview.style.height = rect.height + 'px';
    }
  }
  
  // 立即设置一次
  setWebviewSize();
  
  // 延迟设置确保DOM完全渲染
  setTimeout(setWebviewSize, 50);
  setTimeout(setWebviewSize, 200);
  setTimeout(setWebviewSize, 500);
  
  webviewContainer.appendChild(webview);
  
  // 添加到DOM
  tabsContainer.insertBefore(tab, newTabBtn);
  browserContainer.appendChild(webviewContainer);
  
  // 标签页数据
  const tabData = {
    id: tabId,
    element: tab,
    webview: webview,
    container: webviewContainer,
    title: title,
    url: url,
    loading: false
  };
  
  tabs.push(tabData);
  
  // 事件监听
  setupWebviewEvents(tabData);
  setupTabEvents(tabData);
  
  // 切换到新标签页
  switchToTab(tabId);
  
  return tabData;
}

// 设置webview事件
function setupWebviewEvents(tabData) {
  const { webview, element, id } = tabData;
  const tabTitle = element.querySelector('.tab-title');
  const tabLoading = element.querySelector('.tab-loading');
  
  // 注入脚本拦截所有链接点击和window.open
  function injectLinkInterceptor() {
    try {
      webview.executeJavaScript(`
        (function() {
          console.log('开始注入链接拦截脚本');

          // 避免重复注入
          if (window.__linkInterceptorInjected) {
            console.log('链接拦截脚本已存在，跳过注入');
            return;
          }
          window.__linkInterceptorInjected = true;
          console.log('链接拦截脚本注入成功');

          // 定义全局函数供注入脚本调用
          window.__createNewTab = function(url) {
            console.log('调用 __createNewTab，URL:', url);
            // 创建一个隐藏的div元素来传递消息
            const messageDiv = document.createElement('div');
            messageDiv.id = 'webview-message-' + Date.now();
            messageDiv.setAttribute('data-type', 'create-new-tab');
            messageDiv.setAttribute('data-url', url);
            messageDiv.style.display = 'none';
            document.body.appendChild(messageDiv);

            // 触发自定义事件
            const event = new CustomEvent('webviewMessage', {
              detail: { type: 'create-new-tab', url: url, id: messageDiv.id }
            });
            document.dispatchEvent(event);

            console.log('消息div已创建，ID:', messageDiv.id);
          };

          // 定义全局函数用于在当前标签页导航
          window.__navigateCurrentTab = function(url) {
            console.log('调用 __navigateCurrentTab，URL:', url);
            // 使用特殊的协议来触发主进程的拦截
            window.location.href = 'electron-navigate://' + encodeURIComponent(url);
          };

          // 拦截window.open调用
          const originalOpen = window.open;
          window.open = function(url, target, features) {
            console.log('拦截到 window.open 调用:', url, target);
            if (url && (target === '_blank' || target === '_new' || !target)) {
              console.log('处理新窗口打开请求');
              // 处理相对URL
              let finalUrl = url;
              if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('javascript:') && !url.startsWith('#')) {
                try {
                  const baseUrl = window.location.href;
                  finalUrl = new URL(url, baseUrl).href;
                  console.log('相对URL转换:', url, '->', finalUrl);
                } catch (e) {
                  console.log('URL转换失败:', e);
                  // URL解析失败，保持原样
                }
              }
              window.__createNewTab(finalUrl);
              return null;
            }
            return originalOpen.call(window, url, target, features);
          };

          // 拦截所有链接点击
          document.addEventListener('click', function(e) {
            console.log('检测到点击事件');
            let target = e.target;
            // 向上查找链接元素
            while (target && target.tagName !== 'A') {
              target = target.parentElement;
            }

            if (target && target.tagName === 'A') {
              const href = target.getAttribute('href');
              const targetAttr = target.getAttribute('target');
              console.log('点击了链接:', href, 'target:', targetAttr);

              // 对于所有有效的链接，都阻止默认行为并创建新标签页
              if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                console.log('拦截链接，创建新标签页:', href, 'target:', targetAttr);
                e.preventDefault();
                e.stopPropagation();

                // 处理相对URL
                let finalUrl = href;
                if (href && !href.startsWith('http://') && !href.startsWith('https://')) {
                  try {
                    const baseUrl = window.location.href;
                    finalUrl = new URL(href, baseUrl).href;
                    console.log('相对URL转换:', href, '->', finalUrl);
                  } catch (e) {
                    console.log('URL转换失败:', e);
                    // URL解析失败，保持原样
                  }
                }

                // 所有链接都创建新标签页
                window.__createNewTab(finalUrl);
              }
              // 对于 javascript: 和 mailto: 链接，允许默认行为
            }
          }, true); // 使用捕获阶段确保优先处理

          console.log('链接拦截脚本注入完成');
        })();
      `).catch(err => {
        console.log('无法注入链接拦截脚本:', err);
      });
    } catch (e) {
      console.log('注入链接拦截脚本失败:', e);
    }
  }
  
  webview.addEventListener('did-start-loading', () => {
    tabData.loading = true;
    tabLoading.style.display = 'block';
    tabTitle.style.display = 'none';
    
    if (activeTabId === id) {
      statusText.textContent = '正在加载...';
    }
  });
  
  webview.addEventListener('did-stop-loading', () => {
    tabData.loading = false;
    tabLoading.style.display = 'none';
    tabTitle.style.display = 'block';
    
    if (activeTabId === id) {
      statusText.textContent = '加载完成';
      updateNavigationButtons();
      
      const currentUrl = webview.getURL();
      if (currentUrl && currentUrl !== 'about:blank') {
        urlInput.value = currentUrl;
        tabData.url = currentUrl;
      }
      
      webview.executeJavaScript('document.title').then(title => {
        const pageTitleText = title || '无标题';
        tabData.title = pageTitleText;
        tabTitle.textContent = pageTitleText;
        
        if (activeTabId === id) {
          pageTitle.textContent = pageTitleText;
        }
      }).catch(() => {
        if (activeTabId === id) {
          pageTitle.textContent = '';
        }
      });
    }
  });
  
  webview.addEventListener('did-fail-load', (event) => {
    tabData.loading = false;
    tabLoading.style.display = 'none';
    tabTitle.style.display = 'block';
    
    if (event.errorCode === -3) return; // 忽略导航取消
    
    if (activeTabId === id) {
      let errorMsg = '加载失败';
      switch (event.errorCode) {
        case -105: errorMsg = '无法连接到服务器'; break;
        case -106: errorMsg = '连接超时'; break;
        case -107: errorMsg = '无效的URL'; break;
        case -109: errorMsg = '找不到服务器'; break;
      }
      statusText.textContent = `错误: ${errorMsg}`;
      showError(`${errorMsg} (${event.errorDescription || event.errorCode})`);
    }
  });
  
  webview.addEventListener('page-title-updated', (event) => {
    const title = event.title || '无标题';
    tabData.title = title;
    tabTitle.textContent = title;
    
    if (activeTabId === id) {
      pageTitle.textContent = title;
    }
  });
  
  webview.addEventListener('did-navigate', (event) => {
    tabData.url = event.url;

    if (activeTabId === id) {
      urlInput.value = event.url;
      statusText.textContent = `已导航到: ${event.url}`;
      updateNavigationButtons();
    }
  });
  
  webview.addEventListener('did-navigate-in-page', (event) => {
    tabData.url = event.url;

    if (activeTabId === id) {
      urlInput.value = event.url;
      updateNavigationButtons();
    }
  });
  
  // 拦截新窗口，在客户端内打开
  webview.addEventListener('new-window', (event) => {
    console.log('new-window 事件触发:', event.url, event);
    event.preventDefault();
    const url = event.url;
    
    if (!url || url === 'about:blank' || url === 'javascript:void(0)' || url.startsWith('javascript:')) {
      console.log('跳过无效URL:', url);
      return;
    }
    
    // 处理相对URL
    let finalUrl = url;
    try {
      // 如果是相对URL，转换为绝对URL
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        const currentUrl = webview.getURL();
        if (currentUrl) {
          finalUrl = new URL(url, currentUrl).href;
          console.log('相对URL转换为绝对URL:', url, '->', finalUrl);
        } else {
          console.log('无法获取当前URL，使用原始URL:', url);
        }
      }
      console.log('创建新标签页:', finalUrl);
      createTab(finalUrl);
    } catch (e) {
      console.log('URL处理失败，使用原始URL:', e, url);
      if (url.startsWith('http://') || url.startsWith('https://')) {
        createTab(url);
      }
    }
  });
  
  // 监听webview加载完成，注入拦截脚本
  webview.addEventListener('dom-ready', () => {
    injectLinkInterceptor();

    // 如果这是活动标签页，更新导航按钮状态
    if (activeTabId === id) {
      updateNavigationButtons();
    }

    // 开始检查来自webview的消息
    startMessageChecking();
  });

  // 监听来自webview的消息
  webview.addEventListener('ipc-message', (event) => {
    console.log('收到来自webview的IPC消息:', event.channel, event.args);
    if (event.channel === 'create-new-tab') {
      createTab(event.args[0]);
    }
  });

  // 监听webview的控制台消息，用于调试
  webview.addEventListener('console-message', (event) => {
    console.log('WebView控制台:', event.level, event.message);
  });

  // 监听webview销毁，停止消息检查
  webview.addEventListener('destroyed', () => {
    stopMessageChecking();
  });

  // 定期检查webview中的消息div
  let lastMessageId = null;
  let messageCheckInterval = null;

  const checkForMessages = () => {
    webview.executeJavaScript(`
      (function() {
        const messages = document.querySelectorAll('[id^="webview-message-"]');
        if (messages.length > 0) {
          const message = messages[0]; // 处理第一个消息
          const result = {
            id: message.id,
            type: message.getAttribute('data-type'),
            url: message.getAttribute('data-url')
          };
          // 移除已处理的消息
          message.remove();
          return result;
        }
        return null;
      })()
    `).then(result => {
      if (result && result.id !== lastMessageId) {
        lastMessageId = result.id;
        console.log('收到来自webview的消息:', result);
        if (result.type === 'create-new-tab') {
          createTab(result.url);
        }
      }
    }).catch(err => {
      // 忽略执行错误，webview可能还没有加载完成或者代码有问题
      if (!err.message.includes('Cannot read property') && !err.message.includes('document is not defined')) {
        console.log('检查消息时出错:', err);
      }
    });
  };

  const startMessageChecking = () => {
    if (messageCheckInterval) {
      clearInterval(messageCheckInterval);
    }
    // 每200ms检查一次消息（稍微降低频率以减少性能影响）
    messageCheckInterval = setInterval(checkForMessages, 200);
    console.log('开始检查webview消息');
  };

  const stopMessageChecking = () => {
    if (messageCheckInterval) {
      clearInterval(messageCheckInterval);
      messageCheckInterval = null;
      console.log('停止检查webview消息');
    }
  };
  
  // 页面加载完成后也注入脚本（处理动态内容）
  webview.addEventListener('did-finish-load', () => {
    injectLinkInterceptor();
  });
}

// 设置标签页事件
function setupTabEvents(tabData) {
  const { element, id } = tabData;
  const tabClose = element.querySelector('.tab-close');
  
  // 点击标签页切换
  element.addEventListener('click', (e) => {
    if (e.target !== tabClose) {
      switchToTab(id);
    }
  });
  
  // 关闭标签页
  tabClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(id);
  });
}

// 切换到指定标签页
function switchToTab(tabId) {
  if (activeTabId === tabId) return;
  
  // 隐藏当前标签页
  if (activeTabId) {
    const prevTab = tabs.find(t => t.id === activeTabId);
    if (prevTab) {
      prevTab.element.classList.remove('active');
      prevTab.container.classList.remove('active');
    }
  }
  
  // 显示新标签页
  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    activeTabId = tabId;
    tab.element.classList.add('active');
    tab.container.classList.add('active');
    
    // 强制webview重新计算尺寸
    function resizeWebview() {
      if (tab.webview && tab.container) {
        const containerRect = browserContainer.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
          tab.container.style.width = containerRect.width + 'px';
          tab.container.style.height = containerRect.height + 'px';
          tab.webview.style.width = containerRect.width + 'px';
          tab.webview.style.height = containerRect.height + 'px';
        }
      }
    }
    
    // 立即执行
    resizeWebview();
    // 延迟执行确保DOM更新
    setTimeout(resizeWebview, 10);
    setTimeout(resizeWebview, 50);
    setTimeout(resizeWebview, 200);
    
    // 更新URL输入框和状态
    urlInput.value = tab.url || '';
    
    // 更新标题
    tab.webview.executeJavaScript('document.title').then(title => {
      pageTitle.textContent = title || '';
    }).catch(() => {
      pageTitle.textContent = '';
    });
  }
}

// 关闭标签页
function closeTab(tabId) {
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;
  
  const tab = tabs[tabIndex];
  
  // 如果是当前活动标签页，切换到其他标签页
  if (activeTabId === tabId) {
    if (tabs.length > 1) {
      // 优先切换到右侧标签页，否则切换到左侧
      const nextTab = tabs[tabIndex + 1] || tabs[tabIndex - 1];
      if (nextTab) {
        switchToTab(nextTab.id);
      }
    }
  }
  
  // 移除DOM
  tab.element.remove();
  tab.container.remove();
  
  // 从数组中移除
  tabs.splice(tabIndex, 1);
  
  // 如果没有标签页了，创建新标签页
  if (tabs.length === 0) {
    createTab();
  }
}

// 更新导航按钮状态
function updateNavigationButtons() {
  if (!activeTabId) {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
    return;
  }
  
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webview) {
    backBtn.disabled = !tab.webview.canGoBack();
    forwardBtn.disabled = !tab.webview.canGoForward();
  }
}

// 显示错误信息
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// 在当前活动标签页加载URL
function loadUrlInActiveTab(url) {
  if (!url) return;
  
  const formattedUrl = formatUrl(url);
  
  if (!activeTabId) {
    createTab(formattedUrl);
    return;
  }
  
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    errorMessage.classList.remove('show');
    tab.webview.src = formattedUrl;
    urlInput.value = formattedUrl;
  }
}

// 事件监听
goBtn.addEventListener('click', () => {
  const url = urlInput.value;
  if (url) {
    loadUrlInActiveTab(url);
  }
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const url = urlInput.value;
    if (url) {
      loadUrlInActiveTab(url);
    }
  }
});

backBtn.addEventListener('click', () => {
  if (activeTabId) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.webview.canGoBack()) {
      tab.webview.goBack();
    }
  }
});

forwardBtn.addEventListener('click', () => {
  if (activeTabId) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.webview.canGoForward()) {
      tab.webview.goForward();
    }
  }
});

reloadBtn.addEventListener('click', () => {
  if (activeTabId) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      tab.webview.reload();
    }
  }
});

newTabBtn.addEventListener('click', () => {
  createTab();
});

// 窗口大小改变时调整所有webview尺寸
function resizeAllWebviews() {
  const rect = browserContainer.getBoundingClientRect();
  tabs.forEach(tab => {
    if (tab.webview && tab.container && rect.width > 0 && rect.height > 0) {
      tab.container.style.width = rect.width + 'px';
      tab.container.style.height = rect.height + 'px';
      tab.webview.style.width = rect.width + 'px';
      tab.webview.style.height = rect.height + 'px';
    }
  });
}

window.addEventListener('resize', () => {
  resizeAllWebviews();
});

// 监听来自主进程的消息（用于外部链接，在新标签页打开）
ipcRenderer.on('load-url', (event, url) => {
  createTab(url);
});

// 监听来自主进程的消息（用于webview内部链接，在当前标签页导航）
ipcRenderer.on('navigate-current-tab', (event, url) => {
  console.log('收到来自主进程的消息，在当前标签页导航:', url);
  loadUrlInActiveTab(url);
});

// 监听来自webview的消息
window.addEventListener('message', (event) => {
  // 只处理来自webview的消息
  if (event.data && event.data.fromWebview) {
    console.log('收到来自webview的消息:', event.data);
    if (event.data.type === 'CREATE_NEW_TAB') {
      createTab(event.data.url);
    }
  }
});

// 消息监听器已移除，现在使用特殊的协议和主进程拦截

// 初始化：创建第一个标签页
createTab();

