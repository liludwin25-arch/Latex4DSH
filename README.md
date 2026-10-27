# dsh-plugin-latex-math

> 让 DSH 里的每个公式都排版成 LaTeX，而不是 `IC50`、`10^-9`、`p<0.05` 这种电脑写法。

装一次，**所有会话的公式默认走 LaTeX**——Web / TUI / CLI / 子代理 / workflow 全部继承，由 DSH 前端自带的 KaTeX 排版。

- 零依赖、零文件写入、不改 DSH 源码
- 一条 system-prompt 规则，全局作用域
- 可配置：严格/宽松模式、中英文、终端输出策略、追加自定义规则
- 自带 8 个冒烟测试，`node --test` 直接跑

## 为什么需要它

DSH 的 Markdown 渲染器本来就支持 TeX：`$...$`、`$$...$$`、`\(...\)`、`\[...\]` 都会交给 KaTeX 排版（见 `@deepseek-ai/dsh-client-ui-primitives`，前端 vendor CSS 也打包了 KaTeX）。**问题不在渲染，在规则**：基础 system prompt 没有"公式必须用 LaTeX"这一条，于是模型默认输出 ASCII / Unicode 伪数学。

本插件就是把这条规则做成一个常驻的 prompt section。

### 装前 / 装后

| | 输出 |
|---|---|
| 装前 | `IC50 约为 10^-9 M，p<0.05，Kd=KM 时达到 Vmax 的一半` |
| 装后 | `$IC_{50}$ 约为 $10^{-9}\ \mathrm{M}$，$p<0.05$，$K_d=K_M$ 时达到 $V_{max}$ 的一半` |

名字类保持纯文本：p53、PD-1、TGF-β、IL-2 不会被包成公式。

## 安装

### 从 GitHub 安装（推荐）

```sh
dsh plugin --profile web add github:<你的用户名>/dsh-plugin-latex-math
```

> `package.json` 里的 `repository` 目前是占位地址，fork 后记得改成自己的。

### 从本地目录安装（最稳）

```sh
git clone https://github.com/<你的用户名>/dsh-plugin-latex-math.git
dsh plugin --profile web add ./dsh-plugin-latex-math
```

### 安装后

1. 重启 DSH（DSH Desktop 需完全退出，含托盘图标）
2. Web 页面按 `Ctrl+Shift+R` 强制刷新
3. 插件会写入 profile 的 `package.json` + `pnpm-lock.yaml`，DSH 升级不会丢

卸载：

```sh
dsh plugin --profile web remove dsh-plugin-latex-math
```

## 配置

默认开箱即用，不用配置。要改，在 profile 的 `cordis.patch.yml` 里按 id 覆盖（插件 bundle 已经插入了 `latex-math-policy` 这一行，这里只覆盖 config）：

```yaml
- id: latex-math-policy
  config:
    language: en        # zh | en
    mode: strict        # strict | lenient
    machineText: plain  # plain | latex
    extra: "引用文献时保留原始编号"
```

| 键 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | `true` / `false` | `true` | 关掉注入（不删包） |
| `language` | `zh` / `en` | `zh` | 规则文本语言 |
| `mode` | `strict` / `lenient` | `strict` | lenient 允许基因/蛋白/药物名也 LaTeX 化 |
| `machineText` | `plain` / `latex` | `plain` | 终端、日志、CSV、数据库字段是否也写 LaTeX |
| `extra` | 字符串 | 空 | 追加自定义规则，原样拼在 section 末尾 |

临时禁用：

```yaml
- id: latex-math-policy
  disabled: true
```

## 验证是否生效

1. `Cmd+N` 开新会话（macOS；Windows/Linux 是 `Ctrl+N`），或点侧栏「新会话」
2. 先验证规则确实注入：问 **「把你当前收到的公式输出规范复述一遍」**
3. 再验证实际输出：问 **「给出 Henderson–Hasselbalch 方程和米氏方程，并解释 $K_M$」**

判定：

- ✅ 公式是排版后的（不是 `$...$` 原文）、量符号带下标、名字仍是纯文本 → 生效
- ❌ 看到 `10^-9`、`IC50`、用 `α` 拼公式 → 规则没进会话，检查安装和重启

> 流式输出时公式会先显示 `$...$` 原文，消息结束后才排版——前端在 settled 之后才跑 KaTeX，属正常现象，不是失败。

## 工作原理

```js
export const name = 'dsh-plugin-latex-math';
export const inject = ['systemPrompt'];

export function apply(ctx, config) {
  const cfg = resolveConfig(config, ctx);
  if (!cfg.enabled) return;
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'plugin:latex-math-policy',
    order: 400,          // persona(0) 之后，plan policy(500) 之前
    text: policyText(cfg)
  }), 'latex-math-policy.section()');
}
```

- 插件挂在 profile 根部 → section 是**全局作用域**，所有会话、子代理、workflow 继承
- `ctx.effect` 在卸载 / 禁用 / 热更新时自动注销 section
- 不写任何文件，不动 `~/.dsh/AGENTS.md`；profile 开了 `patchReload: live` 时改配置可热生效

## 和 `~/.dsh/AGENTS.md` 的关系

两者都能达到"公式默认 LaTeX"：

| 方式 | 特点 |
|---|---|
| 本插件 | 装一次全局生效，带配置，可随包分享 |
| `~/.dsh/AGENTS.md` | 手写规则文件，零安装，但要自己维护 |

**二选一。** 已经写了全局 AGENTS.md 公式规则的话，建议删掉那一节再用插件，避免重复注入浪费 token。

## 已知限制

| 现象 | 原因 / 处理 |
|---|---|
| 流式时先看到 `$...$` 原文 | 前端在消息 settled 后才跑 KaTeX，正常 |
| 代码块里的公式不排版 | 渲染器不对 code fence 跑 KaTeX；不要让要排版的公式进代码块 |
| `\ce{H2O}` 报错 | KaTeX 核心不含 mhchem，改用 `$\mathrm{H_2O}$` |
| docx / PDF 里没有排版公式 | LaTeX 只是文本，需要 OMML / pandoc 管线 |
| 终端、数据库字段仍是纯文本 | `machineText: plain` 的默认行为，改成 `latex` 可反转 |
| 某个 agent preset 里规则没生效 | 该 preset 用 `complete: true` 的 persona 整段替换了 system prompt，会把本 section 一起替换掉；需要在该 preset 里自带规则 |

## 兼容性

- `@deepseek-ai/dsh` 0.1.x（依赖 base 自带的 `systemPrompt` 服务）
- Node.js ≥ 20
- 未来版本若服务名变化，插件会因 `inject` 不满足而不激活——不会弄坏启动

## 开发

```sh
node --test          # 8 个冒烟测试，零依赖
```

```
lib/index.js          插件本体（prompt 策略 + 配置）
cordis.patch.yml      把 latex-math-policy 行插入 profile
test/smoke.test.mjs   node:test 冒烟测试
examples/             配置示例
```

## 发布到 GitHub

```sh
cd dsh-plugin-latex-math
git init -b main
git add -A
git commit -m "feat: LaTeX formula policy plugin for DSH"
git remote add origin git@github.com:<你的用户名>/dsh-plugin-latex-math.git
git push -u origin main
git tag v1.0.0 && git push --tags
```

发布前改掉占位：

- `package.json` 的 `repository` / `homepage` / `bugs`
- 本文件与 `README.en.md` 里的 `<你的用户名>`

可选：`npm publish`（包名未被占用时），之后可直接 `dsh plugin --profile web add dsh-plugin-latex-math`。

## License

MIT
