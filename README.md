# CarbonIQ 建筑全生命周期碳排放分析

CarbonIQ 是一个可在个人电脑上运行的建筑 LCA 学习项目。用户可导入 CSV 或 XLSX 材料清单，查看 A1–A3 核算、数据审查、情景比较和 AI 辅助分析。模型结论依赖输入数据及其来源，不能代替工程验证。

## 下载 Windows 安装包

Windows x64 用户可从 [v0.2.3 发布页](https://github.com/zybjack268-svg/carboniq-building-lca/releases/tag/v0.2.3)下载 `CarbonIQ-Setup-0.2.3-x64.exe` 并安装。安装后可通过桌面的 CarbonIQ 快捷方式打开，安装版不需要另行安装 Node.js。首次启动时，在模型配置窗口填写 OpenAI 兼容接口的 Base URL、模型 ID 和 API Key；之后可从桌面应用的“CarbonIQ → 模型配置”菜单更换。配置保存在本机应用数据目录，不包含在安装包中。安装包未做代码签名，Windows 可能显示发布者未知提示。

## 从源码运行或打包

源码运行需要 Node.js 22.19 或更新版本及 npm，还需要一个可调用 OpenAI 兼容 Chat Completions 接口的模型 API Key。

```bash
git clone https://github.com/zybjack268-svg/carboniq-building-lca.git
cd <克隆得到的目录>
npm ci
npm run local
```

首次启动时，在终端依次输入 Base URL、模型 ID 和 API Key。程序会生成网站访问码，并在 <http://127.0.0.1:4174/> 启动。请在浏览器中输入访问码。以后重新运行 `npm run local`，模型配置从本机 `.local/config.json` 读取，浏览器会在 30 天内记住登录状态。

`npm run local` 只允许本机访问。若要让同一局域网内的设备访问，可运行 `npm run local:lan`，详见 [本机部署说明](LOCAL_DEPLOY.md)。项目不需要 ChatGPT 网页账号；模型服务商的 API Key 和相应调用额度仍由运行网站的人提供。不要将 `.local/config.json`、API Key 或访问码提交到 GitHub。

要从源码生成 Windows 安装包，请在 Windows 上安装 NSIS 3 并确保 `makensis.exe` 在 PATH 中，然后运行 `npm ci` 和 `npm run package:win`；安装文件写入 `release/`。已有 electron-builder 的 NSIS 缓存时会自动使用该缓存。

要在另一台 Windows 电脑复现实验，请按 [异机测试命令](OTHER_COMPUTER_TEST.md) 操作。

## 工作流

打开网站后先进入对话首页，可以直接向智能体咨询数据需求，再按需要选择阶段：

- **A1–A3 材料生产**：上传材料清单，核对字段、因子、成本和来源，运行材料核算与智能体分析。清单可含可选的成本单价列；缺失成本时智能体会提醒，但分析继续。支持在"材料清单核对"中从内置因子库（GB/T 51366-2019 附录A/D/E 全表）选用因子，候选材料支持导入 PDF / Word / Excel / CSV（本地解析优先，模型辅助识别需用户勾选同意），并保存在本机浏览器中。
- **A4 运输**：导入运输路线 CSV/XLSX 或逐项填写，只计算完整路线的小计。
- **A5 建造过程**：导入施工活动 CSV/XLSX 或逐项填写，只计算完整活动的小计。施工数字孪生夜景场景包含塔吊、挖掘机、运输车辆与照明塔灯，机械随工序联动；粒子密度按各活动排放占比示意（可关闭）。
- **B6 运营能源**：导入或填写年度用电、燃气及外购热力（含省级电力因子库）。运营能耗数字孪生以夜景建筑与三色能流粒子（电力/燃气/热力，密度按排放占比）呈现，并附排放构成与情景年限图表；智能体分析给出节能方向与数据核实建议。

各阶段可以独立运行，未录入的阶段不视为零；年度 B6 不与一次性的建设阶段直接相加。A4、A5、B6 导入时先在本地识别表头。使用者勾选页面上的模型识别选项后，表头无法识别时才会把受限预览发送给所配置的模型服务；模型只定位原始列，数值仍从文件读取并由本地计算。运行智能体分析会发送所选阶段的数据和计算小计，请在使用前确认文件与模型服务的适用性。

## 使用范围和第三方权利

本项目新增的网页、智能体和工作流内容采用 [CarbonIQ 非商业使用许可](LICENSE)：允许下载、查看、安装和运行未经修改的版本，并将生成的分析结果用于非商业用途。使用者应自行核实数据、结论及适用规则。未经另行书面授权，不得修改、二次开发或商用这些新增内容；本许可不是开源许可证。

本仓库含有独立许可的第三方内容，以上说明不改变其原有授权。Building LCA 上游部分及 Libraries.dev 的 bot-avatars 组件采用 MIT 许可，来源见 [第三方声明](THIRD_PARTY_NOTICES.md)。上游 MIT 许可允许相应上游代码被商业使用，不能由本项目新增内容的使用范围追溯限制。

## 开发验证

```bash
npm run build
node --test tests/*.test.mjs
```

`npm run dev` 仅用于本机开发，不启用访问码保护。
