# Changelog

## 1.0.0 — 2026-10-26

- 首个版本：通过 `systemPrompt` section 全局注入 LaTeX 公式输出规范
- 配置项：`enabled` / `language` / `mode` / `machineText` / `extra`
- 严格模式：量、式、化学式走 LaTeX；基因、蛋白、药物名保持纯文本
- 非渲染场景（终端、日志、CSV、数据库字段、JSON、代码字符串）默认保持纯文本
- 零依赖、零文件写入；卸载/禁用时自动注销 section
- 自带 `node:test` 冒烟测试（8 个用例）
