# CarbonIQ 建筑全生命周期碳排放分析

CarbonIQ 是一个可在个人电脑上运行的建筑 LCA 学习项目。用户可导入 CSV 或 XLSX 材料清单，查看 A1–A3 核算、数据审查、情景比较和 AI 辅助分析。模型结论依赖输入数据及其来源，不能代替工程验证。

## 环境要求

- Node.js 22.19 或更新版本
- npm（随 Node.js 安装）
- 一个可调用 OpenAI 兼容 Chat Completions 接口的模型 API Key

## 从 GitHub 下载并启动

```bash
git clone https://github.com/zybjack268-svg/carboniq-building-lca.git
cd <克隆得到的目录>
npm ci
npm run local
```

首次启动时，在终端依次输入 Base URL、模型 ID 和 API Key。程序会生成网站访问码，并在 <http://127.0.0.1:4174/> 启动。请在浏览器中输入访问码。以后重新运行 `npm run local`，模型配置从本机 `.local/config.json` 读取，浏览器会在 30 天内记住登录状态。

`npm run local` 只允许本机访问。若要让同一局域网内的设备访问，可运行 `npm run local:lan`，详见 [本机部署说明](LOCAL_DEPLOY.md)。项目不需要 ChatGPT 网页账号；模型服务商的 API Key 和相应调用额度仍由运行网站的人提供。不要将 `.local/config.json`、API Key 或访问码提交到 GitHub。

要在另一台 Windows 电脑复现实验，请按 [异机测试命令](OTHER_COMPUTER_TEST.md) 操作。

## 使用范围和第三方权利

本项目新增的网页、智能体和工作流内容采用 [CarbonIQ 个人学习使用许可](LICENSE)：允许下载、查看、安装和运行未经修改的版本，用于非商业、非竞赛的个人学习与交流；**未经另行书面授权，不允许修改、二次开发、商用或用于竞赛**。本许可不是开源许可证。

本仓库含有独立许可的第三方内容，以上说明不改变其原有授权。Building LCA 上游部分采用 MIT 许可，相关文本保留在 [第三方许可](THIRD_PARTY_LICENSES/BUILDING_LCA_MIT.txt)；aora 角色组件的非商用条件见 [第三方声明](THIRD_PARTY_NOTICES.md)。上游 MIT 许可允许相应上游代码被商业使用，不能由本项目新增内容的使用范围追溯限制。

## 开发验证

```bash
npm run build
node --test tests/*.test.mjs
```

`npm run dev` 仅用于本机开发，不启用访问码保护。
