# 在另一台 Windows 电脑上测试

先安装 Git 和 Node.js 22.19 或更新版本，并重新打开 PowerShell。检查版本：

```powershell
git --version
node --version
npm --version
```

从 GitHub 克隆本项目并启动：

```powershell
git clone https://github.com/zybjack268-svg/carboniq-building-lca.git
cd carboniq-building-lca
npm ci
npm run local
```

首次启动时，终端会询问 Base URL、模型 ID 和 API Key。请使用这台电脑所有者自己的模型服务凭据；项目不要求 ChatGPT 网页账号。终端显示访问码后，在同一台电脑的浏览器打开 <http://127.0.0.1:4174/> 并输入访问码。

停止服务按 `Ctrl+C`。第二次打开时，在项目目录只需运行：

```powershell
npm run local
```

如果首次启动提示端口被占用，可在 PowerShell 中换端口运行：

```powershell
$env:PORT = "4175"
npm run local
```

此时打开 <http://127.0.0.1:4175/>。同一电脑上的模型配置保存在 `.local/config.json`；浏览器 Cookie 与端口有关，换端口后可能需要重新输入访问码。
