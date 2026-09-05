# AI Content Localization Assistant

面向 TECNO 尼日利亚 TikTok 内容团队的人工智能本地化与审核辅助工具。

## 功能

- 默认聚焦 TECNO CAMON 40 Pro 5G、Nigeria、TikTok 短视频口播
- 选择目标市场、平台、语气和目标用户
- 根据产品事实生成 20-35 秒社交媒体脚本
- 输出有来源的产品事实和待人工确认内容
- 编辑生成结果并保存为新版本
- 将最终文案导出为纯文本文件

## 多模态互动（借鉴 OpenMontage 的 agent 流水线思想）

在保留"事实溯源 + 人工审核"核心创新的前提下，参考 OpenMontage
（reference-driven input、scene_plan 阶段、音频 providers、agent 对话式编排）
加入了五个多模态能力：

- 参考素材工坊：上传产品图（最多 4 张）或本地参考短视频（浏览器自动抽 4 帧），
  Vision 模型提取可核验的产品事实与创作风格笔记；只有能对应到素材原文的事实才会进入证据链，
  价格、上市时间等高风险字段一律转入待人工确认
- 语音输入：浏览器 Web Speech API 口述需求（中文 / 英文），零 API 成本
- 分镜卡（Scene Plan）：TikTok 脚本自动拆成逐镜头时间轴（画面 / 口播 / 字幕），
  结果卡片显示"N 镜分镜"标识
- 口播试听：浏览器 TTS 整段或逐镜头朗读脚本，可调语速，零 API 成本
- AI 对话精修：对单条结果用一句话迭代（如"Hook 更强一点"）；每次修改在服务端重新执行
  证据校验与禁用词检查，未通过的内容自动转入待人工确认，审核门控不会被绕过

## 本地运行

```powershell
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`，在设置中填写兼容 OpenAI 接口的 API Key 和 Base URL。

## 项目边界

这是一个个人产品项目。模拟访谈和测试数据仅用于展示产品方法，不代表真实商业上线结果。项目中保留原始开源许可证文件；如对外分发代码，请一并保留该许可证。

## 测试数据

测试样例位于 `test-data/content-localization-cases.json`。
