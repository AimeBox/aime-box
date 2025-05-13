import { execSync } from 'child_process';
import os from 'os';

export type SystemProxySettings = {
  proxyEnable: boolean;
  proxyServer: string;
};

export function getSystemProxySettings(): SystemProxySettings {
  const platform = os.platform();

  if (platform === 'win32') {
    return getWindowsProxySettings();
  } else if (platform === 'darwin') {
    return getMacProxySettings();
  } else {
    console.warn('当前系统不支持动态获取（只支持 Windows 和 macOS）');
    return { proxyEnable: false, proxyServer: '' };
  }
}

function getWindowsProxySettings(): SystemProxySettings {
  try {
    const output = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"',
    ).toString();

    let proxyEnable = false;
    let proxyServer = '';

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('ProxyEnable')) {
        const match = line.match(/0x(\d+)/);
        proxyEnable = match ? parseInt(match[1]) !== 0 : false;
      }

      if (line.includes('ProxyServer')) {
        const match = line.match(/\s+REG_SZ\s+(.*)/);
        proxyServer = match ? match[1].trim() : '';
      }
    }

    // 规范化成 http://xxx 形式
    if (proxyEnable && proxyServer && !proxyServer.startsWith('http')) {
      proxyServer = `http://${proxyServer}`;
    }

    return { proxyEnable, proxyServer };
  } catch (err) {
    console.error('读取注册表失败:', err);
    return { proxyEnable: false, proxyServer: '' };
  }
}

function getMacProxySettings(): SystemProxySettings {
  try {
    // 默认用 Wi-Fi 网络服务
    const httpOutput = execSync('networksetup -getwebproxy "Wi-Fi"').toString();
    const httpsOutput = execSync(
      'networksetup -getsecurewebproxy "Wi-Fi"',
    ).toString();

    const http = parseMacProxyOutput(httpOutput);
    const https = parseMacProxyOutput(httpsOutput);

    let proxyEnable = false;
    let proxyServer = '';

    if (http.enabled && http.server) {
      proxyEnable = true;
      proxyServer = `http://${http.server}:${http.port}`;
    } else if (https.enabled && https.server) {
      proxyEnable = true;
      proxyServer = `http://${https.server}:${https.port}`; // 这里依然返回 http:// 方便统一处理
    }

    return { proxyEnable, proxyServer };
  } catch (err) {
    console.error('读取 macOS 代理失败:', err);
    return { proxyEnable: false, proxyServer: '' };
  }
}

function parseMacProxyOutput(output: string) {
  const lines = output.split('\n');
  let enabled = false;
  let server = '';
  let port = '';

  for (const line of lines) {
    if (line.startsWith('Enabled:')) {
      enabled = line.includes('Yes');
    }
    if (line.startsWith('Server:')) {
      server = line.replace('Server: ', '').trim();
    }
    if (line.startsWith('Port:')) {
      port = line.replace('Port: ', '').trim();
    }
  }

  return { enabled, server, port };
}
