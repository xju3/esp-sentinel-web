import 'katex/dist/katex.min.css';
import katex from 'katex';
import './style.css';

document.addEventListener('DOMContentLoaded', async () => {
  // 0. 加载配置数据
  async function loadConfigData() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        console.warn('API加载失败:', response.status);
        return null;
      }
      const config = await response.json();
      console.log('从API加载配置数据成功');
      await loadBatteryConfig();
      return config;
    } catch (error) {
      console.warn('Error loading config:', error);
      return null;
    }
  }

  // 0.1 填充表单数据
  function populateFormData(config) {
    if (!config) return;

    // ISO 标准 - 新数据结构使用数字值：1 = "iso 10816", 2 = "iso 20816"
    if (config.iso?.standard) {
      // 将数字值转换为对应的字符串值
      let isoValue;
      if (config.iso.standard === 1) {
        isoValue = "ISO10816";
      } else if (config.iso.standard === 2) {
        isoValue = "ISO20816";
      } else {
        isoValue = config.iso.standard; // 保持向后兼容
      }
      
      const isoBtn = document.querySelector(`[data-value="${isoValue}"]`);
      if (isoBtn) {
        isoBtn.click();
      }
    }

    // 机械类别 - 需要等待下拉菜单初始化
    if (config.iso?.category !== undefined) {
      const categoryValue = config.iso.category.toString(); // 转换为字符串，因为data-value是字符串
      const categoryInput = document.getElementById('iso-category');
      const categoryLabel = document.getElementById('iso-category-label');
      
      if (categoryInput) {
        categoryInput.value = categoryValue;

        // 延迟执行，确保下拉菜单已初始化
        setTimeout(() => {
          // 查找对应的选项标签并更新显示
          const dropdown = document.getElementById('iso-category-dropdown');
          if (dropdown) {
            const item = dropdown.querySelector(`[data-value="${categoryValue}"]`);
            if (item) {
              const label = item.querySelector('.font-medium')?.textContent || '未选择';
              if (categoryLabel) categoryLabel.textContent = label;
              // 检查是否需要显示安装基础选择（特别是Class II的情况）
              checkFoundationRequirement(categoryValue);
            } else {
              console.warn(`未找到机械类别选项: ${categoryValue}`);
              // 尝试重新初始化下拉菜单
              const isoStandardBtn = document.querySelector('#iso-standard .pill.active');
              if (isoStandardBtn) {
                const isAdvanced = isoStandardBtn.dataset.value === 'ISO20816';
                updateIsoCategoryDropdown(isAdvanced);
                
                // 再次尝试查找
                setTimeout(() => {
                  const newItem = dropdown.querySelector(`[data-value="${categoryValue}"]`);
                  if (newItem) {
                    const newLabel = newItem.querySelector('.font-medium')?.textContent || '未选择';
                    if (categoryLabel) categoryLabel.textContent = newLabel;
                    checkFoundationRequirement(categoryValue);
                  }
                }, 50);
              }
            }
          }
        }, 100);
      }
    }

    // 安装基础 - 新数据结构使用数字值：1 = "硬基", 2 = "软基"
    if (config.iso?.foundation !== undefined) {
      // 将数字值转换为对应的字符串值
      let foundationValue;
      if (config.iso.foundation === 1) {
        foundationValue = "rigid";
      } else if (config.iso.foundation === 2) {
        foundationValue = "flexible";
      } else {
        foundationValue = config.iso.foundation; // 保持向后兼容
      }
      
      // 延迟执行，确保安装基础选择组已显示
      setTimeout(() => {
        const foundationBtn = document.querySelector(`#foundation-select [data-value="${foundationValue}"]`);
        if (foundationBtn) {
          foundationBtn.click();
        } else {
          console.warn(`未找到安装基础选项: ${foundationValue} (原始值: ${config.iso.foundation})`);
        }
      }, 150); // 稍长延迟，确保机械类别已处理完成
    }

    // 设备信息
    if (config.deviceId !== undefined) {
      const deviceIdInput = document.getElementById('device-id');
      if (deviceIdInput) deviceIdInput.value = config.deviceId || '';
    }

    if (config.deviceName !== undefined) {
      const deviceNameInput = document.getElementById('device-name');
      if (deviceNameInput) deviceNameInput.value = config.deviceName || '';
    }

    if (config.rpm !== undefined) {
      const rpmInput = document.getElementById('device-rpm');
      if (rpmInput) rpmInput.value = config.rpm || '';
    }

    if (config.months !== undefined) {
      const monthInput = document.getElementById('months-used');
      if (monthInput) monthInput.value = config.months || '';
    }

    // 检测频率
    if (config.detect !== undefined) {
      const freqBtn = document.querySelector(`#detect-frequency [data-value="${config.detect}"]`);
      if (freqBtn) {
        freqBtn.click();
      }
    }

    // 上报周期
    if (config.report !== undefined) {
      const rangeInput = document.getElementById('report-cycle');
      if (rangeInput) {
        rangeInput.value = config.report;
        const cycleVal = document.getElementById('cycle-val');
        if (cycleVal) cycleVal.textContent = config.report;
        // 立即更新上报频率显示
        calculateReportFrequency();
      }
    }

    // 通讯方式
    if (config.network!== undefined) {
      const commBtn = document.querySelector(`#comm-type [data-value="${config.network}"]`);
      if (commBtn) {
        commBtn.click();

        // 如果是WiFi，需要加载并选择之前的SSID
        if (config.network=== 2 && config.wifi?.ssid) {
          // 保存要设置的SSID和密码到全局变量，供WiFi扫描完成后使用
          window.savedWifiConfig = {
            ssid: config.wifi.ssid,
            password: config.wifi.pass
          };

          // 延迟以允许WiFi选择框初始化
          setTimeout(() => {
            // 先检查WiFi选择框是否已经初始化
            const wifiSelect = document.getElementById('wifi-select');
            if (wifiSelect && wifiSelect.options.length > 1) {
              // 如果已经初始化，直接设置值
              setWifiSelection(window.savedWifiConfig.ssid, window.savedWifiConfig.password);
            } else {
              // 否则启动扫描，扫描完成后会自动检查并设置
              scanWifiNetworks();
            }
          }, 100);
        }
      }
    }

    // 辅助函数：设置WiFi选择
    function setWifiSelection(ssid, password) {
      const wifiSelect = document.getElementById('wifi-select');
      if (!wifiSelect) return;

      // 尝试找到匹配的选项
      let found = false;
      for (let i = 0; i < wifiSelect.options.length; i++) {
        const option = wifiSelect.options[i];
        // 比较SSID（去除信号强度信息）
        const optionText = option.textContent;
        const ssidMatch = optionText.match(/^([^(]+)/);
        if (ssidMatch && ssidMatch[1].trim() === ssid) {
          wifiSelect.selectedIndex = i;
          found = true;
          break;
        }
        // 或者直接比较value
        if (option.value === ssid) {
          wifiSelect.selectedIndex = i;
          found = true;
          break;
        }
      }

      if (found) {
        // 触发change事件以更新密码框显示
        wifiSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // 如果有密码，填充到密码框
        if (password) {
          const wifiPassword = document.getElementById('wifi-password');
          if (wifiPassword) {
            wifiPassword.value = password;
            // 确保密码框显示
            const pwdContainer = document.getElementById('wifi-password-container');
            if (pwdContainer && wifiSelect.options[wifiSelect.selectedIndex]?.dataset.encrypted === '1') {
              pwdContainer.style.display = 'block';
            }
          }
        }
      } else {
        console.warn('Saved WiFi network not found in scan results:', ssid);
        // 如果没有找到，但SSID不为空，可以尝试手动添加一个选项
        if (ssid && ssid.trim() !== '') {
          const option = document.createElement('option');
          option.value = ssid;
          option.textContent = `${ssid} (未扫描到)`;
          option.dataset.encrypted = '1'; // 假设需要密码
          wifiSelect.appendChild(option);
          wifiSelect.selectedIndex = wifiSelect.options.length - 1;
          wifiSelect.dispatchEvent(new Event('change', { bubbles: true }));

          if (password) {
            const wifiPassword = document.getElementById('wifi-password');
            if (wifiPassword) {
              wifiPassword.value = password;
              const pwdContainer = document.getElementById('wifi-password-container');
              if (pwdContainer) pwdContainer.style.display = 'block';
            }
          }
        }
      }
    }

    // 服务器地址
    if (config.host !== undefined) {
      const serverHostInput = document.getElementById('server-host');
      if (serverHostInput) serverHostInput.value = config.host || 'sentinel-cloud.com';
    }
  }

  // 直接使用用户提供的测试数据
  const configData = {
    iso: {
      standard: 1,
      category: 3,
      foundation: 1
    },
    deviceId: "HELLO-KITTY",
    deviceName: "HELLO-KITTY",
    rpm: 1480,
    months: 6,
    battery: 19000,
    host: "192.168.1.5",
    detect: 30,
    report: 6,
    network: 1,
    ble: true,
    wifi: {
      ssid: "CU_Up3k",
      pass: "hen6n6c7"
    },
    configured: false
  };
  
  console.log('使用硬编码的测试数据:', JSON.stringify(configData, null, 2));

  // 加载并填充配置数据
  console.log('开始加载并填充配置数据...');
  
  // 延迟填充，确保所有UI元素已初始化
  setTimeout(() => {
    console.log('开始填充表单数据...');
    populateFormData(configData);
    
    // 额外延迟后检查填充结果
    setTimeout(() => {
      console.log('数据填充完成，检查结果:');
      checkDataLoadingResults(configData);
    }, 1000);
  }, 500); // 增加延迟到500ms，确保DOM完全加载

  // 检查数据加载结果的函数
  function checkDataLoadingResults(config) {
    console.log('=== 数据加载结果检查 ===');
    
    // 检查机械类别
    const categoryInput = document.getElementById('iso-category');
    const categoryLabel = document.getElementById('iso-category-label');
    console.log('机械类别输入值:', categoryInput?.value, '期望:', config.iso?.category);
    console.log('机械类别标签:', categoryLabel?.textContent);
    
    // 检查设备信息
    const deviceId = document.getElementById('device-id');
    const deviceName = document.getElementById('device-name');
    const deviceRpm = document.getElementById('device-rpm');
    const monthsUsed = document.getElementById('months-used');
    console.log('设备编号:', deviceId?.value, '期望:', config.deviceId);
    console.log('设备名称:', deviceName?.value, '期望:', config.deviceName);
    console.log('额定转速:', deviceRpm?.value, '期望:', config.rpm);
    console.log('已用月数:', monthsUsed?.value, '期望:', config.months);
    
    // 检查检测策略
    const reportCycle = document.getElementById('report-cycle');
    console.log('上报周期:', reportCycle?.value, '期望:', config.report);
    
    // 检查服务器地址
    const serverHost = document.getElementById('server-host');
    console.log('服务器地址:', serverHost?.value, '期望:', config.host);
    
    // 检查ISO标准
    const isoStandardBtn = document.querySelector('#iso-standard .pill.active');
    console.log('ISO标准:', isoStandardBtn?.dataset.value, '期望:', config.iso?.standard);
    
    // 检查安装基础
    const foundationBtn = document.querySelector('#foundation-select .pill.active');
    console.log('安装基础:', foundationBtn?.dataset.value, '期望:', config.iso?.foundation);
    
    // 检查通讯方式
    const commTypeBtn = document.querySelector('#comm-type .pill.active');
    console.log('通讯方式:', commTypeBtn?.dataset.value, '期望:', config.network);
    
    console.log('=== 检查完成 ===');
  }

  // 1. KaTeX 渲染示例 (在 ISO 标准描述中渲染公式)
  const katexContainer = document.getElementById('katex-formula');
  if (katexContainer) {
    katex.render("v_{RMS} = \\sqrt{\\frac{1}{T} \\int_{0}^{T} v^2(t) dt}", katexContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.1 FFT公式渲染
  const fftFormulaContainer = document.getElementById('fft-formula');
  if (fftFormulaContainer) {
    katex.render("X(k) = \\sum_{n=0}^{N-1} x(n) \\cdot e^{-j \\frac{2\\pi}{N} nk}, \\quad k = 0, \\dots, N-1", fftFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.2 希尔伯特变换公式渲染
  const hilbertFormulaContainer = document.getElementById('hilbert-formula');
  if (hilbertFormulaContainer) {
    katex.render("\\hat{x}(t) = \\frac{1}{\\pi} \\int_{-\\infty}^{\\infty} \\frac{x(\\tau)}{t - \\tau} d\\tau", hilbertFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 1.3 峭度公式渲染
  const kurtosisFormulaContainer = document.getElementById('kurtosis-formula');
  if (kurtosisFormulaContainer) {
    katex.render("K = \\frac{\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\bar{x})^4}{(\\frac{1}{N} \\sum_{i=1}^{N} (x_i - \\bar{x})^2)^2}", kurtosisFormulaContainer, {
      throwOnError: false,
      displayMode: false
    });
  }

  // 2. 状态管理
  let currentStep = 1;
  const totalSteps = 5;

  // 3. UI 元素引用
  const panels = document.querySelectorAll('.panel');
  const steps = document.querySelectorAll('.step');
  const mask = document.getElementById('processing-mask');

  // 4. 导航逻辑
  function updateUI(stepIndex) {
    // 更新面板
    panels.forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(`panel-${stepIndex}`) || document.getElementById('panel-5');
    if (targetPanel) targetPanel.classList.add('active');

    // 更新步骤条
    steps.forEach(s => {
      const sIndex = parseInt(s.dataset.step);
      if (sIndex <= stepIndex) s.classList.add('active');
      else s.classList.remove('active');
    });

    currentStep = stepIndex;

    // 如果是检测策略页面（第4步），确保电池容量显示正确
    if (stepIndex === 4) {
      // 重新获取电池容量元素，因为面板可能之前是隐藏的
      const batteryCapacityElement = document.getElementById('battery-capacity');
      if (batteryCapacityElement && batteryCapacity) {
        batteryCapacityElement.textContent = `${batteryCapacity} mAh`;
      }
      
      // 重新计算电池续航
      const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
      const rangeInput = document.getElementById('report-cycle');
      if (detectFreqBtn && rangeInput) {
        const detectInterval = parseInt(detectFreqBtn.dataset.value);
        const reportCycle = parseInt(rangeInput.value);
        calculateBatteryLife(detectInterval, reportCycle);
      }
    }

    // 如果是预览页，收集并展示配置信息
    if (stepIndex === 5) {
      showConfigPreview();
    }
  }

  // 4.1 收集配置信息并展示预览
  function showConfigPreview() {
    // ISO 标准部分
    const isoStandardBtn = document.querySelector('#iso-standard .pill.active');
    const isoStandard = isoStandardBtn ? isoStandardBtn.textContent : 'ISO 10816 (通用)';
    document.getElementById('preview-iso-standard').textContent = isoStandard;

    const isoCategoryLabel = document.getElementById('iso-category-label');
    const isoCategoryText = isoCategoryLabel && isoCategoryLabel.textContent
      ? isoCategoryLabel.textContent
      : '未选择';
    document.getElementById('preview-iso-category').textContent = isoCategoryText;

    // 显示/隐藏基础选择预览
    const foundationGroup = document.getElementById('foundation-group');
    const foundationContainer = document.getElementById('preview-foundation-container');
    if (foundationGroup && foundationGroup.style.display !== 'none') {
      foundationContainer.style.display = 'block';
      const foundationBtn = document.querySelector('#foundation-select .pill.active');
      const foundationText = foundationBtn ? foundationBtn.textContent : '未选择';
      document.getElementById('preview-foundation').textContent = foundationText;
    } else {
      foundationContainer.style.display = 'none';
    }

    // 设备信息部分
    const deviceId = document.getElementById('device-id').value || '-';
    const deviceName = document.getElementById('device-name').value || '-';
    const deviceRpm = document.getElementById('device-rpm').value || '-';
    const monthsUsed = document.getElementById('months-used').value || '-';

    document.getElementById('preview-device-id').textContent = deviceId;
    document.getElementById('preview-device-name').textContent = deviceName;
    document.getElementById('preview-device-rpm').textContent = deviceRpm;
    document.getElementById('preview-months-used').textContent = monthsUsed;

    // 检测策略部分
    const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
    const detectFreq = detectFreqBtn ? detectFreqBtn.textContent : '30分钟';
    document.getElementById('preview-detect-frequency').textContent = detectFreq;

    const reportCycle = document.getElementById('report-cycle').value;
    document.getElementById('preview-report-cycle').textContent = `${reportCycle} 次检测后`;

    // 电池续航预览
    const batteryLifeElement = document.getElementById('battery-life');
    if (batteryLifeElement) {
      const batteryLifeText = batteryLifeElement.textContent || '- 天';
      document.getElementById('preview-battery-life').textContent = batteryLifeText;
    }

    // 通讯配置部分
    const commTypeBtn = document.querySelector('#comm-type .pill.active');
    const commType = commTypeBtn ? commTypeBtn.textContent : '4G通讯';
    document.getElementById('preview-comm-type').textContent = commType;

    const wifiContainer = document.getElementById('preview-wifi-container');
    if (commType === '4G通讯') {
      wifiContainer.style.display = 'none';
    } else {
      wifiContainer.style.display = 'block';
      const wifiSsid = document.getElementById('wifi-select').value || '-';
      document.getElementById('preview-wifi-ssid').textContent = wifiSsid;
    }

    // 服务器地址
    const serverHost = document.getElementById('server-host').value || 'sentinel-cloud.com';
    document.getElementById('preview-server-host').textContent = serverHost;
  }

  // 绑定下一步按钮
  document.querySelectorAll('[id^="to-"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.id.replace('to-', '');
      const currentStep = parseInt(targetId) - 1;

      // 验证当前步骤的必填字段
      if (!validateStep(currentStep)) {
        return; // 验证失败，不切换面板
      }

      updateUI(parseInt(targetId));
    });
  });

  // Toast提示函数
  function showErrorToast(message, title = '错误') {
    const toast = document.getElementById('error-toast');
    const errorTitle = document.getElementById('error-title');
    const errorMessage = document.getElementById('error-message');

    if (toast && errorTitle && errorMessage) {
      errorTitle.textContent = title;
      errorMessage.textContent = message;

      // 显示Toast
      toast.classList.remove('hidden');
      toast.classList.remove('translate-x-full');

      // 5秒后自动隐藏
      setTimeout(() => {
        hideErrorToast();
      }, 5000);
    }
  }

  function hideErrorToast() {
    const toast = document.getElementById('error-toast');
    if (toast) {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 300);
    }
  }

  // 绑定Toast关闭按钮
  const closeToastBtn = document.getElementById('close-error-toast');
  if (closeToastBtn) {
    closeToastBtn.addEventListener('click', hideErrorToast);
  }

  // 步骤验证函数
  function validateStep(step) {
    let isValid = true;
    let errorMessage = '';

    switch (step) {
      case 1: // 第1步：ISO标准与环境
        // 验证评价标准
        const isoStandardBtn = document.querySelector('#iso-standard .pill.active');
        if (!isoStandardBtn) {
          isValid = false;
          errorMessage = '请选择评价标准';
          break;
        }

        // 验证机械类别
        const isoCategory = document.getElementById('iso-category').value;
        if (!isoCategory) {
          isValid = false;
          errorMessage = '请选择机械类别';
          break;
        }

        // 验证安装基础（如果显示则为必选项）
        const foundationGroup = document.getElementById('foundation-group');
        if (foundationGroup && foundationGroup.style.display !== 'none') {
          const foundationBtn = document.querySelector('#foundation-select .pill.active');
          if (!foundationBtn) {
            isValid = false;
            errorMessage = '请选择安装基础';
            break;
          }
        }
        break;

      case 2: // 第2步：设备信息
        // 验证额定转速 - 必须大于等于1
        const rpmInput = document.getElementById('device-rpm');
        const rpmValue = rpmInput.value.trim();

        if (rpmValue === '') {
          isValid = false;
          errorMessage = '请输入额定转速';
          // 高亮显示错误字段
          rpmInput.classList.add('border-red-500');
          rpmInput.focus();
        } else {
          // 检查是否为有效数字
          const rpmNum = parseFloat(rpmValue);
          if (isNaN(rpmNum)) {
            isValid = false;
            errorMessage = '请输入有效的数字';
            rpmInput.classList.add('border-red-500');
            rpmInput.focus();
          } else if (rpmNum < 1) {
            isValid = false;
            errorMessage = '额定转速必须大于等于1';
            rpmInput.classList.add('border-red-500');
            rpmInput.focus();
          } else {
            rpmInput.classList.remove('border-red-500');
          }
        }

        // 验证已用月数 - 必须大于等于0
        const monthInput = document.getElementById('months-used');
        const monthValue = monthInput.value.trim();

        // 已用月数不是必填项，但如果填写了就需要验证
        if (monthValue !== '') {
          const monthNum = parseFloat(monthValue);
          if (isNaN(monthNum)) {
            isValid = false;
            errorMessage = '已用月数必须是有效的数字';
            monthInput.classList.add('border-red-500');
            monthInput.focus();
          } else if (monthNum < 0) {
            isValid = false;
            errorMessage = '已用月数必须大于等于0';
            monthInput.classList.add('border-red-500');
            monthInput.focus();
          } else {
            monthInput.classList.remove('border-red-500');
          }
        } else {
          // 如果未填写，清除可能的错误样式
          monthInput.classList.remove('border-red-500');
        }
        break;

      case 3: // 第3步：通讯配置
        // 验证通讯方式
        const commTypeBtn = document.querySelector('#comm-type .pill.active');
        if (!commTypeBtn) {
          isValid = false;
          errorMessage = '请选择通讯方式';
          break;
        }

        // 验证服务器地址 - 只需要域名或IP地址即可
        const serverHost = document.getElementById('server-host').value.trim();
        if (!serverHost) {
          isValid = false;
          errorMessage = '请输入服务器地址';
          const serverHostInput = document.getElementById('server-host');
          serverHostInput.classList.add('border-red-500');
          serverHostInput.focus();
        } else {
          // 更宽松的验证：允许域名、IP地址、带端口的域名/IP
          // 移除可能的协议前缀（http://, https://, mqtt://等）
          let hostToValidate = serverHost;

          // 如果包含协议前缀，移除它
          const protocolRegex = /^(https?|mqtt|ws|wss|ftp):\/\//i;
          if (protocolRegex.test(hostToValidate)) {
            hostToValidate = hostToValidate.replace(protocolRegex, '');
          }

          // 验证基本格式：域名或IP地址
          // 域名正则：允许字母、数字、连字符、点号
          // IP地址正则：IPv4格式
          const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

          // 检查是否包含端口
          let hostWithoutPort = hostToValidate;
          let port = '';
          if (hostToValidate.includes(':')) {
            const parts = hostToValidate.split(':');
            hostWithoutPort = parts[0];
            port = parts[1];

            // 验证端口号
            if (port) {
              const portNum = parseInt(port, 10);
              if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                isValid = false;
                errorMessage = '端口号必须在1-65535之间';
                const serverHostInput = document.getElementById('server-host');
                serverHostInput.classList.add('border-red-500');
                serverHostInput.focus();
                break;
              }
            }
          }

          // 验证主机部分
          if (!domainRegex.test(hostWithoutPort) && !ipv4Regex.test(hostWithoutPort)) {
            isValid = false;
            errorMessage = '请输入有效的域名或IP地址（如 example.com 或 192.168.1.1）';
            const serverHostInput = document.getElementById('server-host');
            serverHostInput.classList.add('border-red-500');
            serverHostInput.focus();
          } else {
            document.getElementById('server-host').classList.remove('border-red-500');
          }
        }

        // 如果是WiFi，验证WiFi配置
        if (commTypeBtn.dataset.value === '2') {
          const wifiSelect = document.getElementById('wifi-select');
          if (!wifiSelect.value) {
            isValid = false;
            errorMessage = '请选择WiFi网络';
            wifiSelect.classList.add('border-red-500');
            wifiSelect.focus();
          } else {
            wifiSelect.classList.remove('border-red-500');

            // 检查是否需要密码
            const selectedOption = wifiSelect.options[wifiSelect.selectedIndex];
            const isEncrypted = selectedOption.dataset.encrypted === '1';
            if (isEncrypted) {
              const wifiPassword = document.getElementById('wifi-password').value.trim();
              if (!wifiPassword) {
                isValid = false;
                errorMessage = '此WiFi网络已加密，请输入密码';
                const wifiPasswordInput = document.getElementById('wifi-password');
                wifiPasswordInput.classList.add('border-red-500');
                wifiPasswordInput.focus();
              } else {
                document.getElementById('wifi-password').classList.remove('border-red-500');
              }
            }
          }
        }
        break;

      case 4: // 第4步：检测策略
        // 验证检测频率
        const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
        if (!detectFreqBtn) {
          isValid = false;
          errorMessage = '请选择检测频率';
          break;
        }

        // 验证上报周期（range slider总是有值，但需要验证是否在范围内）
        const reportCycle = document.getElementById('report-cycle').value;
        if (!reportCycle || reportCycle < 1 || reportCycle > 24) {
          isValid = false;
          errorMessage = '上报周期必须在1-24之间';
          break;
        }
        break;
    }

    if (!isValid && errorMessage) {
      showErrorToast(errorMessage);
    }

    return isValid;
  }

  // 绑定上一步按钮
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetStep = parseInt(e.target.dataset.back);
      updateUI(targetStep);
    });
  });

  // 5. Pill 选择逻辑 (通用)
  document.querySelectorAll('.pill-group').forEach(group => {
    group.addEventListener('click', (e) => {
      if (e.target.classList.contains('pill')) {
        // 移除同组其他 active
        group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');

        // 特殊逻辑：基础选择显示/隐藏
        if (group.id === 'iso-standard') {
          const isAdvanced = e.target.dataset.value === 'ISO20816';
          const foundationGroup = document.getElementById('foundation-group');

          // 无论切换到哪个ISO标准，都先隐藏安装基础
          foundationGroup.style.display = 'none';
          clearFoundationSelection();

          // 清空当前选择的机械类别
          document.getElementById('iso-category').value = '';
          document.getElementById('iso-category-label').textContent = '请选择设备类型';

          // 根据ISO标准更新机械类别选项
          updateIsoCategoryDropdown(isAdvanced);
        }
      }
    });
  });

  // 5.1 更新ISO类别下拉菜单
  function updateIsoCategoryDropdown(isAdvanced) {
    const dropdown = document.getElementById('iso-category-dropdown');
    let options = [];

    if (isAdvanced) {
      // ISO 20816 高级选项 - 包含LaTeX公式
      options = [
        {
          value: 1,
          label: '中大型工业电机 (Motor)',
          formula: 'P > 15\\text{ kW}, \\ 120 \\sim 15000\\text{ RPM}'
        },
        {
          value: 2,
          label: '卧式离心泵 (Horizontal Pump)',
          formula: '\\text{独立轴承}, \\ P > 15\\text{ kW}'
        },
        {
          value: 3,
          label: '立式旋转机械 (Vertical Machine)',
          formula: 'P > 15\\text{ kW}, \\ \\text{垂直悬挂结构}'
        },
        {
          value: 4,
          label: '高速透平机械 (High-speed Turbo)',
          formula: 'n > 15000\\text{ RPM}'
        }
      ];
    } else {
      // ISO 10816 通用选项
      options = [
        { value: 1, label: 'Class I', formula: '15\\text{--}75\\text{ kW}' },
        { value: 2, label: 'Class II', formula: '\\leq 300\\text{ kW}' },
        { value: 3, label: 'Class III/IV', formula: '> 300\\text{ kW}' }
      ];
    }

    // 生成下拉菜单HTML
    dropdown.innerHTML = options.map((opt, idx) => `
      <div class="dropdown-item p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors" data-value="${opt.value}" data-index="${idx}">
        <div class="font-medium text-slate-900">${opt.label}</div>
        ${opt.formula ? `<div class="text-sm text-slate-500 mt-1" id="formula-${opt.value}"></div>` : ''}
      </div>
    `).join('');

    // 用KaTeX渲染公式
    options.forEach(opt => {
      if (opt.formula) {
        try {
          const formulaContainer = document.getElementById(`formula-${opt.value}`);
          if (formulaContainer) {
            katex.render(`${opt.formula}`, formulaContainer, {
              throwOnError: false,
              displayMode: false
            });
          }
        } catch (e) {
          console.error('KaTeX render error:', e);
        }
      }
    });

    // 绑定选项点击事件
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const value = item.dataset.value;
        const label = item.querySelector('.font-medium').textContent;
        document.getElementById('iso-category').value = value;
        document.getElementById('iso-category-label').textContent = label;
        dropdown.classList.add('hidden');

        // 检查是否需要显示安装基础选择
        checkFoundationRequirement(value);
      });
    });
  }

  // 5.1.1 检查是否需要显示安装基础选择
  function checkFoundationRequirement(categoryValue) {
    const foundationGroup = document.getElementById('foundation-group');
    const isoStandardBtn = document.querySelector('#iso-standard .pill.active');

    if (!foundationGroup || !isoStandardBtn) return;

    // 只有在ISO 10816标准下才检查
    if (isoStandardBtn.dataset.value === 'ISO10816') {
      // Class II (value: '2') 或 Class III/IV (value: '3') 需要选择安装基础
      if (categoryValue === '2' || categoryValue === '3') {
        foundationGroup.style.display = 'block';
      } else {
        foundationGroup.style.display = 'none';
        // 清空已选择的安装基础
        clearFoundationSelection();
      }
    } else {
      // ISO 20816 总是显示安装基础
      foundationGroup.style.display = 'block';
    }
  }

  // 5.1.2 清空安装基础选择
  function clearFoundationSelection() {
    const foundationBtns = document.querySelectorAll('#foundation-select .pill');
    foundationBtns.forEach(btn => btn.classList.remove('active'));
  }

  // 5.2 ISO类别下拉菜单控制
  const isoCategoryTrigger = document.getElementById('iso-category-trigger');
  const isoCategoryDropdown = document.getElementById('iso-category-dropdown');

  if (isoCategoryTrigger) {
    isoCategoryTrigger.addEventListener('click', () => {
      isoCategoryDropdown.classList.toggle('hidden');
    });
  }

  // 点击页面其他地方关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#iso-category-trigger') && !e.target.closest('#iso-category-dropdown')) {
      isoCategoryDropdown.classList.add('hidden');
    }
  });

  // 初始化ISO类别下拉菜单（默认为ISO 10816）
  updateIsoCategoryDropdown(false);

  // 6. Range Slider 逻辑
  const rangeInput = document.getElementById('report-cycle');
  const rangeVal = document.getElementById('cycle-val');
  const reportFrequency = document.getElementById('report-frequency');

  // 电池续航计算相关元素
  const batteryCapacityElement = document.getElementById('battery-capacity');
  const commTypeDisplayElement = document.getElementById('comm-type-display');
  const batteryLifeElement = document.getElementById('battery-life');

  // 电池容量（从配置读取）
  let batteryCapacity = 9000; // 默认值，从配置加载后会更新

  // 确保电池容量元素存在
  if (batteryCapacityElement) {
    console.log('电池容量元素已找到:', batteryCapacityElement);
  } else {
    console.warn('电池容量元素未找到，ID: battery-capacity');
  }

  // 功耗参数（从consumption.json读取）
  let powerConsumption = {
    imu_working: 1.0,          // IMU工作电流 (mA)
    imu_standby: 0.003,        // IMU待机电流 (mA)
    cellular_working: 500.0,   // 4G工作电流 (mA)
    cellular_standby: 2.0,     // 4G软件待机电流 (mA)
    wifi_working_tx: 285.0,    // WiFi发射电流 (mA)
    wifi_working_rx: 95.0,     // WiFi接收电流 (mA)
    wifi_standby_deep: 0.01    // WiFi深度休眠电流 (mA)
  };

  // 时间参数（秒）
  const SAMPLE_DURATION = 2;    // 每次采集耗时 (秒)
  const REPORT_DURATION = 20;   // 每次上报耗时 (秒)

  // 电池效率系数
  const BATTERY_EFFICIENCY = 0.85; // 电池有效转换率

  // 加载电池容量和功耗配置
  async function loadBatteryConfig() {
    try {
      // 首先尝试从配置数据中获取电池容量
      if (configData && configData.battery !== undefined) {
        batteryCapacity = configData.battery;
        if (batteryCapacityElement) {
          batteryCapacityElement.textContent = `${batteryCapacity} mAh`;
        }
      } else {
        // 如果没有battery字段，使用默认值
        console.log('配置中没有battery字段，使用默认值9000 mAh');
        if (batteryCapacityElement) {
          batteryCapacityElement.textContent = `${batteryCapacity} mAh`;
        }
      }

      // 尝试加载功耗配置（/api/consumption接口）
      // 注意：这个调用在页面加载时执行，但API可能尚未就绪
      // 因此需要优雅地处理失败情况
      await loadPowerConsumptionConfig();

    } catch (error) {
      console.warn('Failed to load battery config:', error);
      // 使用默认值
      if (batteryCapacityElement) {
        batteryCapacityElement.textContent = `${batteryCapacity} mAh`;
      }
    }
  }

  // 加载功耗配置的独立函数，支持重试
  async function loadPowerConsumptionConfig() {
    try {
      console.log('开始加载功耗配置...');
      const consumptionResponse = await fetch('/api/consumption');
      
      if (!consumptionResponse.ok) {
        throw new Error(`API响应状态: ${consumptionResponse.status}`);
      }
      
      const consumption = await consumptionResponse.json();
      
      if (consumption.components) {
        const comp = consumption.components;
        powerConsumption = {
          imu_working: comp.imu?.consumption?.working || 1.0,
          imu_standby: comp.imu?.consumption?.standby || 0.003,
          cellular_working: comp.cellular?.consumption?.working_avg || 500.0,
          cellular_standby: comp.cellular?.consumption?.standby_software || 2.0,
          wifi_working_tx: comp.wifi?.consumption?.working_tx || 285.0,
          wifi_working_rx: comp.wifi?.consumption?.working_rx || 95.0,
          wifi_standby_deep: comp.wifi?.consumption?.standby_deep_sleep || 0.01
        };

        console.log('功耗配置已从API加载:', powerConsumption);
        return true;
      } else {
        throw new Error('API响应格式不正确');
      }
    } catch (error) {
      console.log('功耗配置API请求失败，使用默认值:', error.message);
      // 使用与consumption.json匹配的默认值
      powerConsumption = {
        imu_working: 1.0,
        imu_standby: 0.003,
        cellular_working: 500.0,
        cellular_standby: 2.0,
        wifi_working_tx: 285.0,
        wifi_working_rx: 95.0,
        wifi_standby_deep: 0.01
      };
      return false;
    }
  }

  // 在需要时重新加载功耗配置
  async function reloadPowerConsumptionIfNeeded() {
    // 如果当前使用的是默认值，尝试重新加载
    if (powerConsumption.imu_working === 1.0) { // 检查是否还是默认值
      console.log('检测到使用默认功耗值，尝试重新加载...');
      const success = await loadPowerConsumptionConfig();
      if (success) {
        // 重新计算电池续航
        const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
        const rangeInput = document.getElementById('report-cycle');
        if (detectFreqBtn && rangeInput) {
          const detectInterval = parseInt(detectFreqBtn.dataset.value);
          const reportCycle = parseInt(rangeInput.value);
          calculateBatteryLife(detectInterval, reportCycle);
        }
      }
    }
  }

  // 计算上报频率的函数
  function calculateReportFrequency() {
    const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
    if (!detectFreqBtn || !rangeInput || !reportFrequency) return;

    const detectInterval = parseInt(detectFreqBtn.dataset.value); // 分钟
    const reportCycle = parseInt(rangeInput.value); // 次数

    // 计算总分钟数
    const totalMinutes = detectInterval * reportCycle;

    // 转换为友好的时间显示
    let frequencyText = '';
    if (totalMinutes < 60) {
      frequencyText = `${totalMinutes}分钟`;
    } else if (totalMinutes < 1440) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (minutes === 0) {
        frequencyText = `${hours}小时`;
      } else {
        frequencyText = `${hours}小时${minutes}分钟`;
      }
    } else {
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      if (hours === 0) {
        frequencyText = `${days}天`;
      } else {
        frequencyText = `${days}天${hours}小时`;
      }
    }

    reportFrequency.textContent = frequencyText;

    // 同时计算电池续航
    calculateBatteryLife(detectInterval, reportCycle);
  }

  // 计算电池续航的函数 - 根据提供的公式重新实现
  function calculateBatteryLife(detectInterval, reportCycle) {
    if (!batteryCapacity || !batteryLifeElement) return;

    // 获取通讯方式
    const commTypeBtn = document.querySelector('#comm-type .pill.active');
    const commType = commTypeBtn ? parseInt(commTypeBtn.dataset.value) : 1; // 默认4G

    // 更新通讯方式显示
    if (commTypeDisplayElement) {
      commTypeDisplayElement.textContent = commType === 1 ? '4G通讯' : 'WiFi通讯';
    }

    // 1. 定义变量 (基于consumption.json和业务逻辑)
    // 电池变量
    const C = batteryCapacity; // 电池标称容量 = 9000 mAh
    const η = 0.85; // 电池有效转换率（扣除自放电和升降压损耗）
    const C_eff = C * η; // 有效电量 = 7650 mAh (当C=9000时)

    // 耗电电流变量 (单位: mA) - 从powerConsumption对象获取
    let I_hard_sleep; // 硬休眠总电流
    
    if (commType === 1) {
      // 4G通讯模式
      I_hard_sleep = powerConsumption.cellular_standby + powerConsumption.imu_standby;
    } else {
      // WiFi通讯模式
      I_hard_sleep = powerConsumption.wifi_standby_deep + powerConsumption.imu_standby;
    }

    // 工作电流
    let I_working;
    if (commType === 1) {
      // 4G工作电流
      I_working = powerConsumption.cellular_working + powerConsumption.imu_working;
    } else {
      // WiFi工作电流（取平均值）
      const wifi_avg = (powerConsumption.wifi_working_tx + powerConsumption.wifi_working_rx) / 2;
      I_working = wifi_avg + powerConsumption.imu_working;
    }

    // 2. 计算单次检测-上报周期的总耗电量
    // 检测间隔转换为秒
    const detectIntervalSec = detectInterval * 60;
    
    // 单次检测耗时（秒）
    const t_sample = 2; // SAMPLE_DURATION
    // 单次上报耗时（秒）
    const t_report = 20; // REPORT_DURATION
    
    // 计算一个完整周期的时间（秒）
    const T_cycle = detectIntervalSec * reportCycle;
    
    // 计算一个周期内的总工作时间
    const t_working_total = (t_sample * reportCycle) + t_report;
    
    // 计算一个周期内的休眠时间
    const t_sleep_total = T_cycle - t_working_total;
    
    // 计算一个周期的总耗电量（mAh）
    const Q_cycle = (I_working * t_working_total / 3600) + (I_hard_sleep * t_sleep_total / 3600);
    
    // 3. 计算电池续航（天）
    const days = (C_eff / Q_cycle) * (T_cycle / 86400);
    
    // 4. 显示结果
    let displayText;
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = Math.floor(days % 365);
      displayText = `${years}年${remainingDays > 0 ? remainingDays + '天' : ''}`;
    } else if (days >= 30) {
      const months = Math.floor(days / 30);
      const remainingDays = Math.floor(days % 30);
      displayText = `${months}个月${remainingDays > 0 ? remainingDays + '天' : ''}`;
    } else if (days >= 1) {
      displayText = `${Math.floor(days)}天${Math.floor((days % 1) * 24)}小时`;
    } else {
      const hours = days * 24;
      if (hours >= 1) {
        displayText = `${Math.floor(hours)}小时${Math.floor((hours % 1) * 60)}分钟`;
      } else {
        const minutes = hours * 60;
        displayText = `${Math.floor(minutes)}分钟`;
      }
    }
    
    batteryLifeElement.textContent = displayText;
    
    // 同时更新预览页面的电池续航显示
    const previewBatteryLife = document.getElementById('preview-battery-life');
    if (previewBatteryLife) {
      previewBatteryLife.textContent = displayText;
    }

    // 7. WiFi 逻辑
    const wifiBox = document.getElementById('wifi-box');
    const commTypeGroup = document.getElementById('comm-type');
    const refreshWifiBtn = document.getElementById('refresh-wifi');
    const wifiSelect = document.getElementById('wifi-select');

    // 添加扫描状态标志，防止重复扫描
    let isScanning = false;

    // 监听通讯方式切换 (通过pill-group通用逻辑 + 额外的WiFi处理)
    if (commTypeGroup) {
      commTypeGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill')) {
          const isWifi = e.target.dataset.value === '2';
          if (wifiBox) wifiBox.style.display = isWifi ? 'block' : 'none';
          if (isWifi && !isScanning) {
            simulateWifiScan();
          }
        }
      });
    }

    // 7.1 WiFi 扫描完整流程
    async function scanWifiNetworks() {
      // 防止重复扫描
      if (isScanning) {
        console.log('Scan already in progress, skipping...');
        return false;
      }

      isScanning = true;
      const processingMask = document.getElementById('processing-mask');
      const maskTitle = document.getElementById('mask-title');
      const maskDescription = document.getElementById('mask-description');
      const maskStatus = document.getElementById('mask-status');
      const maskProgress = document.getElementById('mask-progress');
      const maskProgressText = document.getElementById('mask-progress-text');

      try {
        // 显示等待窗口
        if (processingMask) {
          processingMask.classList.remove('hidden');
          processingMask.classList.add('flex');
        }

        // 重置进度
        if (maskProgress) {
          maskProgress.style.width = '0%';
        }
        if (maskProgressText) {
          maskProgressText.textContent = '0%';
        }
        if (maskStatus) {
          maskStatus.textContent = '初始化...';
        }

        // 1. 启动WiFi扫描（只发送请求，不检查结果）
        console.log('发送WiFi扫描启动请求...');
        updateMaskProgress(10, '正在启动WiFi扫描...');
        try {
          // 发送请求但不等待或检查结果
          fetch('/api/wifi-scan-start', { method: 'GET' })
            .then(response => {
              if (response.ok) {
                console.log('WiFi扫描启动请求发送成功');
              } else {
                console.warn('WiFi扫描启动请求返回非200状态:', response.status);
              }
            })
            .catch(error => {
              console.warn('WiFi扫描启动请求发送失败:', error.message);
              // 不抛出错误，继续执行
            });
        } catch (error) {
          console.warn('发送WiFi扫描启动请求时出错:', error.message);
          // 不抛出错误，继续执行
        }

        // 2. 轮询获取扫描结果（5次，每次间隔2秒）
        let wifiData = null;
        let attempts = 0;
        const waitingTime = 2000;
        const maxAttempts = 5;
        
        // 先等待2秒，让设备有时间扫描
        updateMaskProgress(20, '等待设备扫描热点...');
        await new Promise(resolve => setTimeout(resolve, waitingTime));

        while (attempts < maxAttempts) {
          attempts++;
          updateMaskProgress(20 + (attempts * 15), `查询中 (${attempts}/${maxAttempts})...`);
          
          try {
            const response = await fetch('/api/wifi-list');
            if (!response.ok) {
              console.warn(`第${attempts}次查询失败: ${response.status}`);
              if (attempts < maxAttempts) {
                // 等待后继续尝试
                await new Promise(resolve => setTimeout(resolve, waitingTime));
                continue;
              } else {
                throw new Error('获取WiFi列表失败');
              }
            }
            
            const data = await response.json();
            console.log(`第${attempts}次查询响应:`, data);
            
            // 检查是否处理完成
            if (data.status === 'processing') {
              console.log(`第${attempts}次查询：服务器仍在处理中...`);
              if (attempts < maxAttempts) {
                // 等待2秒后重试
                await new Promise(resolve => setTimeout(resolve, waitingTime));
                continue;
              } else {
                throw new Error('WiFi扫描超时，服务器仍在处理中');
              }
            } 
            // 检查是否返回了WiFi网络数据
            else if (data.networks && Array.isArray(data.networks)) {
              wifiData = data.networks;
              if (wifiData.length > 0) {
                console.log(`第${attempts}次查询成功：发现${wifiData.length}个WiFi网络`);
                updateMaskProgress(90, `发现 ${wifiData.length} 个网络...`);
                break; // 成功获取数据，退出循环
              } else {
                console.log(`第${attempts}次查询：发现0个WiFi网络`);
                if (attempts < maxAttempts) {
                  // 等待后继续尝试
                  await new Promise(resolve => setTimeout(resolve, waitingTime));
                  continue;
                } else {
                  throw new Error('未发现任何WiFi网络');
                }
              }
            }
            // 其他响应格式
            else {
              console.log(`第${attempts}次查询：未知响应格式`, data);
              if (attempts < maxAttempts) {
                // 等待后继续尝试
                await new Promise(resolve => setTimeout(resolve, waitingTime));
                continue;
              } else {
                throw new Error('服务器返回未知格式的响应');
              }
            }
          } catch (error) {
            console.log(`第${attempts}次查询异常:`, error.message);
            if (attempts < maxAttempts) {
              // 等待后继续尝试
              await new Promise(resolve => setTimeout(resolve, waitingTime));
              continue;
            } else {
              throw error;
            }
          }
        }

        if (!wifiData) {
          throw new Error('WiFi scan timeout or no data received');
        }

        // 3. 过滤信号弱的热点 (rssi < -75)，但如果没有强信号的则显示所有
        updateMaskProgress(95, '正在处理扫描结果...');
        let filteredNetworks = wifiData.filter(network => {
          return network.rssi >= -75;
        });

        if (filteredNetworks.length === 0) {
          // 如果没有强信号网络，显示所有扫到的网络
          filteredNetworks = wifiData;
        }

        if (filteredNetworks.length === 0) {
          throw new Error('No available WiFi networks found');
        }

        // 4. 填充WiFi选择下拉菜单
        const wifiSelect = document.getElementById('wifi-select');
        if (wifiSelect) {
          // 按信号强度排序（从强到弱）
          filteredNetworks.sort((a, b) => b.rssi - a.rssi);
          wifiSelect.innerHTML = '<option value="">请选择 WiFi</option>';
          filteredNetworks.forEach(network => {
            const signalShength = getSignalQuality(network.rssi);
            const encLabel = network.enc ? ' 🔒' : '';
            const option = document.createElement('option');
            option.value = network.ssid;
            option.dataset.encrypted = network.enc ? '1' : '0';
            option.textContent = `${network.ssid} (${signalShength})${encLabel}`;
            wifiSelect.appendChild(option);
          });

          wifiSelect.disabled = false;

          // 5. 检查扫描结果中是否包含用户配置的热点
          if (window.savedWifiConfig && window.savedWifiConfig.ssid) {
            // 延迟一小段时间，确保DOM已更新
            setTimeout(() => {
              setWifiSelection(window.savedWifiConfig.ssid, window.savedWifiConfig.password);
              // 清除保存的配置，避免重复设置
              window.savedWifiConfig = null;
            }, 50);
          }
        }

        // 完成进度
        updateMaskProgress(100, '扫描完成！');

        // 延迟隐藏等待窗口，让用户看到完成状态
        setTimeout(() => {
          if (processingMask) {
            processingMask.classList.add('hidden');
            processingMask.classList.remove('flex');
          }
        }, 1000);

        isScanning = false; // 重置扫描状态
        return true; // 成功

      } catch (error) {
        console.error('WiFi scan error:', error);

        // 显示错误信息
        if (maskTitle) maskTitle.textContent = '扫描失败';
        if (maskDescription) maskDescription.textContent = error.message || '请检查网络连接';
        if (maskStatus) maskStatus.textContent = '错误';
        if (maskProgress) maskProgress.style.width = '100%';
        if (maskProgressText) maskProgressText.textContent = '100%';

        // 3秒后隐藏
        setTimeout(() => {
          if (processingMask) {
            processingMask.classList.add('hidden');
            processingMask.classList.remove('flex');
          }
        }, waitingTime);

        // WiFi选择框禁用
        const wifiSelect = document.getElementById('wifi-select');
        if (wifiSelect) {
          wifiSelect.innerHTML = '<option value="">扫描失败，请重试</option>';
          wifiSelect.disabled = true;
        }

        isScanning = false; // 重置扫描状态
        return false; // 失败
      }
    }

    // 7.1.1 更新遮罩进度
    function updateMaskProgress(percent, statusText) {
      const maskProgress = document.getElementById('mask-progress');
      const maskProgressText = document.getElementById('mask-progress-text');
      const maskStatus = document.getElementById('mask-status');

      if (maskProgress) {
        maskProgress.style.width = `${percent}%`;
      }
      if (maskProgressText) {
        maskProgressText.textContent = `${percent}%`;
      }
      if (maskStatus) {
        maskStatus.textContent = statusText;
      }
    }

    // 7.2 信号强度评级
    function getSignalQuality(rssi) {
      if (rssi >= -50) return '强';
      if (rssi >= -60) return '中强';
      if (rssi >= -70) return '中';
      return '弱';
    }

    // 7.3 模拟 WiFi 扫描入口
    function simulateWifiScan() {
      if (!wifiSelect) return;
      wifiSelect.innerHTML = '<option>正在扫描...</option>';
      wifiSelect.disabled = true;

      // 调用新的扫描流程
      scanWifiNetworks();
    }

    if (refreshWifiBtn) {
      refreshWifiBtn.addEventListener('click', simulateWifiScan);
    }

    // WiFi 密码框显示逻辑 - 仅当选择加密热点时显示
    wifiSelect?.addEventListener('change', (e) => {
      const pwdContainer = document.getElementById('wifi-password-container');
      const wifiPassword = document.getElementById('wifi-password');

      if (!pwdContainer) return;

      if (!e.target.value) {
        // 未选择
        pwdContainer.style.display = 'none';
        if (wifiPassword) wifiPassword.value = '';
      } else {
        // 检查选中项是否加密
        const selectedOption = e.target.options[e.target.selectedIndex];
        const isEncrypted = selectedOption.dataset.encrypted === '1';

        if (isEncrypted) {
          pwdContainer.style.display = 'block';
          if (wifiPassword) wifiPassword.focus();
        } else {
          pwdContainer.style.display = 'none';
          if (wifiPassword) wifiPassword.value = '';
        }
      }
    });

    // 8. 确认配置按钮
    const submitBtn = document.getElementById('submit-config');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        // 验证WiFi配置
        const commTypeBtn = document.querySelector('#comm-type .pill.active');
        const commType = commTypeBtn?.dataset.value;

        if (commType === '2') {
          // 选择了WiFi
          const wifiSelect = document.getElementById('wifi-select');
          const wifiPassword = document.getElementById('wifi-password');

          if (!wifiSelect?.value) {
            showErrorToast('请选择一个WiFi热点');
            return;
          }

          // 检查是否需要密码
          const selectedOption = wifiSelect.options[wifiSelect.selectedIndex];
          const isEncrypted = selectedOption.dataset.encrypted === '1';

          if (isEncrypted && !wifiPassword?.value) {
            showErrorToast('此WiFi网络已加密，请输入密码');
            return;
          }
        }

        // 显示处理中的遮罩
        if (mask) {
          mask.classList.remove('hidden');
          mask.classList.add('flex');
        }

        // 调用API提交配置
        try {
          const isoStandardBtn = document.querySelector('#iso-standard .pill.active');
          // 将字符串值转换为数字值：ISO10816 -> 1, ISO20816 -> 2
          let isoStandardValue = 1; // 默认值
          if (isoStandardBtn?.dataset.value === 'ISO10816') {
            isoStandardValue = 1;
          } else if (isoStandardBtn?.dataset.value === 'ISO20816') {
            isoStandardValue = 2;
          }
          
          const isoCategory = document.getElementById('iso-category')?.value || '';

          const foundationBtn = document.querySelector('#foundation-select .pill.active');
          // 将字符串值转换为数字值：rigid -> 1, flexible -> 2
          let isoFoundationValue = 1; // 默认值
          if (foundationBtn?.dataset.value === 'rigid') {
            isoFoundationValue = 1;
          } else if (foundationBtn?.dataset.value === 'flexible') {
            isoFoundationValue = 2;
          }

          const deviceId = document.getElementById('device-id')?.value || '';
          const deviceName = document.getElementById('device-name')?.value || '';
          const rpm = document.getElementById('device-rpm')?.value || 1480;
          const months = document.getElementById('months-used')?.value || 0;

          const wifiSSID = document.getElementById('wifi-select')?.value || '';
          const wifiPassword = document.getElementById('wifi-password')?.value || '';

          const reportCycle = document.getElementById('report-cycle')?.value || 6;

          const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
          const detectInterval = detectFreqBtn?.dataset.value || 30;

          const commTypeBtn = document.querySelector('#comm-type .pill.active');
          const commType = commTypeBtn?.dataset.value || 1;

          const serverHost = document.getElementById('server-host')?.value || 'sentinel-cloud.com';

          const config = {
            iso: {
              standard: isoStandardValue,
              category: parseInt(isoCategory) || 0,
              foundation: isoFoundationValue
            },
            deviceId: deviceId,
            deviceName: deviceName,
            rpm: parseInt(rpm) || 1480,
            months: parseInt(months) || 0,
            battery: batteryCapacity, // 电池容量
            host: serverHost,
            detect: parseInt(detectInterval) || 30,
            report: parseInt(reportCycle) || 6,
            network: parseInt(commType) || 1,
            ble: true,
            wifi: {
              ssid: wifiSSID,
              pass: wifiPassword
            },
            configured: false
          };

          console.log('sending config:', config);
          const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });

          if (!response.ok) {
            throw new Error(`保存失败: ${response.status}`);
          }

          const result = await response.json();
          console.log('配置已提交:', result);
          showErrorToast('配置已成功提交！设备将立即重启并开始监测。', '成功');
        } catch (error) {
          console.error('Save error:', error);
          showErrorToast('保存失败: ' + error.message);        } finally {
          if (mask) {
            mask.classList.add('hidden');
            mask.classList.remove('flex');
          }
        }
      });
    }
  }

  // 初始化电池续航计算
  function initializeBatteryLifeCalculation() {
    // 获取初始值
    const detectFreqBtn = document.querySelector('#detect-frequency .pill.active');
    const rangeInput = document.getElementById('report-cycle');
    
    if (detectFreqBtn && rangeInput) {
      const detectInterval = parseInt(detectFreqBtn.dataset.value);
      const reportCycle = parseInt(rangeInput.value);
      
      // 初始计算
      calculateBatteryLife(detectInterval, reportCycle);
      
      // 监听检测频率变化
      const detectFrequencyGroup = document.getElementById('detect-frequency');
      if (detectFrequencyGroup) {
        detectFrequencyGroup.addEventListener('click', (e) => {
          if (e.target.classList.contains('pill')) {
            setTimeout(() => {
              const newDetectInterval = parseInt(e.target.dataset.value);
              const currentReportCycle = parseInt(rangeInput.value);
              calculateBatteryLife(newDetectInterval, currentReportCycle);
              // 同时更新上报频率显示
              calculateReportFrequency();
            }, 10);
          }
        });
      }
      
      // 监听上报周期变化
      if (rangeInput) {
        rangeInput.addEventListener('input', () => {
          const currentDetectInterval = parseInt(detectFreqBtn.dataset.value);
          const newReportCycle = parseInt(rangeInput.value);
          calculateBatteryLife(currentDetectInterval, newReportCycle);
          // 同时更新上报频率显示
          calculateReportFrequency();
        });
      }
      
      // 监听通讯方式变化
      const commTypeGroup = document.getElementById('comm-type');
      if (commTypeGroup) {
        commTypeGroup.addEventListener('click', (e) => {
          if (e.target.classList.contains('pill')) {
            setTimeout(() => {
              const currentDetectInterval = parseInt(detectFreqBtn.dataset.value);
              const currentReportCycle = parseInt(rangeInput.value);
              calculateBatteryLife(currentDetectInterval, currentReportCycle);
              // 同时更新上报频率显示
              calculateReportFrequency();
            }, 10);
          }
        });
      }
    }
  }

  // 页面加载完成后初始化电池续航计算
  setTimeout(() => {
    initializeBatteryLifeCalculation();
  }, 500);
});
