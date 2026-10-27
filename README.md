# dsh-plugin-latex-math

> Make every DSH agent write formulas in LaTeX — not `IC50`, `10^-9`, `p<0.05`.

Install once and **every session** (Web / TUI / CLI / subagents / workflows) inherits a
system-prompt policy that tells the model to write math in LaTeX. DSH's built-in
Markdown renderer typesets it with KaTeX.

- Zero dependencies, zero file writes, no patching of DSH itself
- One global `systemPrompt` section
- Configurable: strict/lenient names, zh/en text, machine-readable output policy, extra rules
- 8 smoke tests, run with `node --test`

## Why

DSH already typesets TeX: `$...$`, `$$...$$`, `\(...\)` and `\[...\]` all go through KaTeX
(see `@deepseek-ai/dsh-client-ui-primitives`; the frontend vendor CSS bundles KaTeX too).
What the base system prompt lacks is the rule that formulas **must** be written that way,
so agents default to ASCII / Unicode pseudo-math.

This plugin adds exactly that rule as a persistent prompt section.

### Before / after

| | Output |
|---|---|
| Before | `IC50 is about 10^-9 M, p<0.05, Kd=KM at half Vmax` |
| After | `$IC_{50}$ is about $10^{-9}\ \mathrm{M}$, $p<0.05$, $K_d=K_M$ at half $V_{max}$` |

Names stay plain text: p53, PD-1, TGF-β, IL-2 are never wrapped in math.

## Install

### From GitHub (recommended)

```sh
dsh plugin --profile web add github:<your-name>/dsh-plugin-latex-math
```

> The `repository` field is a placeholder — update it after forking.

### From a local clone (most reliable)

```sh
git clone https://github.com/<your-name>/dsh-plugin-latex-math.git
dsh plugin --profile web add ./dsh-plugin-latex-math
```

### After installing

1. Restart DSH (on DSH Desktop quit completely, tray icon included)
2. Hard-refresh the Web page with `Ctrl+Shift+R`
3. The plugin lands in the profile's `package.json` + `pnpm-lock.yaml`, so DSH upgrades keep it

Uninstall:

```sh
dsh plugin --profile web remove dsh-plugin-latex-math
```

## Configuration

Works out of the box. To customize, override by id in the profile's `cordis.patch.yml`
(the bundle patch already inserts the `latex-math-policy` row; this only overrides config):

```yaml
- id: latex-math-policy
  config:
    language: en        # zh | en
    mode: strict        # strict | lenient
    machineText: plain  # plain | latex
    extra: "Keep citation numbers as-is"
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `enabled` | `true` / `false` | `true` | Turn the policy off without removing the package |
| `language` | `zh` / `en` | `zh` | Language of the rule text |
| `mode` | `strict` / `lenient` | `strict` | `lenient` also allows gene/protein/drug names in LaTeX |
| `machineText` | `plain` / `latex` | `plain` | Whether terminal/log/CSV/DB fields also use LaTeX |
| `extra` | string | empty | Extra rules appended verbatim |

Temporarily disable:

```yaml
- id: latex-math-policy
  disabled: true
```

## Verify

1. Start a new session (`Cmd+N` on macOS, `Ctrl+N` elsewhere, or the sidebar's "New session")
2. Prove the rule landed: ask **"recite the formula output rules you received"**
3. Prove the output: ask **"give me the Henderson–Hasselbalch and Michaelis–Menten equations and explain $K_M$"**

Pass criteria:

- ✅ Math is typeset (not raw `$...$`), quantity symbols carry subscripts, names stay plain text
- ❌ You still see `10^-9`, `IC50`, or `α` glued together as a formula → the rule did not reach the session

> While streaming, the raw `$...$` shows first and typesets once the message settles —
> the renderer runs KaTeX only on settled messages. That is expected.

## How it works

```js
export const name = 'dsh-plugin-latex-math';
export const inject = ['systemPrompt'];

export function apply(ctx, config) {
  const cfg = resolveConfig(config, ctx);
  if (!cfg.enabled) return;
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'plugin:latex-math-policy',
    order: 400,          // after persona (0), before plan policy (500)
    text: policyText(cfg)
  }), 'latex-math-policy.section()');
}
```

- The plugin mounts at the profile root, so the section is **global**: every session,
  subagent and workflow inherits it
- `ctx.effect` unregisters the section on disable/unload/hot-reload
- No files written, no `~/.dsh/AGENTS.md` needed; with `patchReload: live` config changes apply hot

## Relationship to `~/.dsh/AGENTS.md`

Both achieve "LaTeX by default":

| Approach | Notes |
|---|---|
| This plugin | Install once, global, configurable, shareable |
| `~/.dsh/AGENTS.md` | Hand-written rule file, no install, self-maintained |

Pick **one**. If you already have a formula section in a global AGENTS.md, remove it to
avoid duplicating the same policy in every prompt.

## Known limits

| Symptom | Cause / fix |
|---|---|
| Raw `$...$` during streaming | KaTeX runs on settled messages only — expected |
| Math inside code blocks is not typeset | The renderer never runs KaTeX on code fences |
| `\ce{H2O}` fails | KaTeX core has no mhchem; use `$\mathrm{H_2O}$` |
| No typeset math in docx/PDF | LaTeX is text; use an OMML/pandoc pipeline |
| Terminal/DB text stays plain | Default `machineText: plain`; set `latex` to invert |
| Rule missing inside one agent preset | That preset uses a `complete: true` persona, which replaces the whole system prompt and drops this section; the preset must carry its own rule |

## Compatibility

- `@deepseek-ai/dsh` 0.1.x (needs the base `systemPrompt` service)
- Node.js ≥ 20
- If a future version renames the service, the plugin simply stays inactive (`inject` unmet)
  and never breaks boot

## Development

```sh
node --test          # 8 zero-dependency smoke tests
```

```
lib/index.js          plugin body (policy + config)
cordis.patch.yml      inserts the latex-math-policy row
test/smoke.test.mjs   node:test smoke tests
examples/             config examples
```

## Publishing to GitHub

```sh
cd dsh-plugin-latex-math
git init -b main
git add -A
git commit -m "feat: LaTeX formula policy plugin for DSH"
git remote add origin git@github.com:<your-name>/dsh-plugin-latex-math.git
git push -u origin main
git tag v1.0.0 && git push --tags
```

Replace the `<your-name>` placeholders in `package.json` (`repository` / `homepage` / `bugs`)
and in both READMEs first.

Optional: `npm publish` (if the name is free), then
`dsh plugin --profile web add dsh-plugin-latex-math`.

## License

MIT
