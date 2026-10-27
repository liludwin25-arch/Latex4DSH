/**
 * dsh-plugin-latex-math — make every DSH agent write formulas in LaTeX.
 *
 * Why a plugin at all: DSH already typesets TeX — the Web/markdown renderer
 * runs KaTeX for `$...$`, `$$...$$`, `\(...\)` and `\[...\]` — but the base
 * system prompt never states that formulas *must* be written that way, so
 * agents default to plain text (`IC50`, `10^-9`, `p<0.05`). This row
 * registers one system-prompt section with the rule; every session inherits
 * it — Web, CLI, TUI, subagents and workflows.
 *
 * Zero dependencies and zero file writes: it only uses the `systemPrompt`
 * service the harness already provides.
 */

/** Cordis plugin name; must match the patch row and the package name. */
export const name = 'dsh-plugin-latex-math';

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt'];

/**
 * Stable prompt-section identity. The name is namespaced so another plugin
 * can shadow it deliberately, and the order sits after the deployment
 * persona (0) and before the plan policy (500).
 */
const SECTION_NAME = 'plugin:latex-math-policy';
const SECTION_ORDER = 400;

const DEFAULT_CONFIG = Object.freeze({
	enabled: true,
	mode: 'strict',
	language: 'zh',
	machineText: 'plain',
	extra: ''
});

const MODES = ['strict', 'lenient'];
const LANGUAGES = ['zh', 'en'];
const MACHINE_TEXT = ['plain', 'latex'];

/** Log through the harness logger when one is attached, otherwise stderr. */
function warn(ctx, message) {
	const line = `[latex-math] ${message}`;
	if (typeof ctx?.logger?.warn === 'function') ctx.logger.warn(line);
	else console.warn(line);
}

/** Read one enum-valued config key, falling back with a warning instead of failing boot. */
function enumValue(ctx, raw, field, allowed, fallback) {
	if (raw === undefined || raw === null) return fallback;
	const value = String(raw).trim().toLowerCase();
	if (allowed.includes(value)) return value;
	warn(ctx, `ignoring invalid ${field} "${String(raw)}" (allowed: ${allowed.join(', ')}); using "${fallback}"`);
	return fallback;
}

/**
 * Normalize loader config. Misspelled or unknown values fall back to the
 * default with a warning rather than failing the whole profile boot.
 * @param config - raw loader config (may be undefined).
 * @param ctx - plugin context, used only for warnings.
 * @returns resolved config.
 */
export function resolveConfig(config, ctx) {
	const raw = config ?? {};
	return {
		enabled: raw.enabled !== false,
		mode: enumValue(ctx, raw.mode, 'mode', MODES, DEFAULT_CONFIG.mode),
		language: enumValue(ctx, raw.language, 'language', LANGUAGES, DEFAULT_CONFIG.language),
		machineText: enumValue(ctx, raw.machineText, 'machineText', MACHINE_TEXT, DEFAULT_CONFIG.machineText),
		extra: typeof raw.extra === 'string' ? raw.extra.trim() : ''
	};
}

/** Chinese policy body. */
function zhRules(cfg) {
	const rules = [
		'## LaTeX 公式输出规范(强制)',
		'',
		'所有数学、统计、物理、化学表达式一律用 LaTeX 书写,由渲染层 KaTeX 排版。禁止用 ASCII 伪数学(`10^-9`、`sqrt(x)`、`p<0.05`、`x/y`)或 Unicode 上下标(`²`、`⁺`、`₀`)冒充公式。',
		'',
		'- 行内公式 `$...$`;独立公式 `$$...$$` 单独成段、前后空行',
		'- 多字母量符号用 `\\mathrm{}`:`$\\mathrm{p}K_a$`、`$\\mathrm{pH}$`;化学式 `$\\mathrm{H_2O_2}$`、`$\\mathrm{Na^+}$`(KaTeX 不支持 `\\ce{}`)',
		'- 数值与单位:`$10^{-9}\\ \\mathrm{M}$`、`$\\mathrm{mg\\,mL^{-1}}$`、`$37\\,^\\circ\\mathrm{C}$`;公式内的中文放 `\\text{...}`',
		'- 表格、列表、引用块里同样用 `$...$`;正文里的美元符号写 `\\$`',
		'',
		'**必须是 LaTeX(量/式)**:方程、不等式、分式、根式、求和积分偏导;统计量(`$p$` 值、`$n$`、`$r^2$`、`$95\\%\\ \\mathrm{CI}$`、`$\\mathrm{HR}$`、`$\\pm$`);量符号与下标(`$K_d$`、`$K_M$`、`$V_{max}$`、`$k_{cat}$`、`$IC_{50}$`、`$EC_{50}$`、`$K_i$`、`$t_{1/2}$`、`$K_{eq}$`);热力学电化学(`$\\Delta G$`、`$\\Delta H$`、`$\\Delta S$`、`$E^\\circ$`);化学式/离子/同位素(`$\\mathrm{CO_2}$`、`$\\mathrm{O_2^-}$`、`$^{14}\\mathrm{C}$`);指数与上下标(`$10^{-6}$`、`$a_{ij}$`);仪器量(`$A_{260}$`、`$\\mathrm{OD}_{600}$`、`$\\times g$`)。',
		'',
		'**必须保持纯文本(名字/标识)**:基因、蛋白、受体、细胞、药物、通路名与缩写(p53、CD4⁺、PD-1、CTLA-4、TGF-β、IL-2、TNF-α、IFN-γ、5-FU、CYP3A4、MHC-I);序列与变异位点(BRAF V600E、rs1234567);文件名、路径、命令、代码标识符、URL、DOI、书目引用;普通数量、日期、版本号。',
		'',
		'判定口径:"名字"保持纯文本,"量/式"用 LaTeX;同一个词两边都像时看上下文——表达大小、比例、关系或单位就是"量"。',
		'',
		'- 代码块(```)里的公式不会被排版:需要排版的公式不要放进代码块',
		'- 流式阶段先显示 `$...$` 原文、消息结束后才排版,属正常现象',
		'- 落盘 `.md` 直接写 LaTeX;`.docx`/`.pdf` 不会自动排版,需要时走 OMML/pandoc 管线,不要假装已排版'
	];
	if (cfg.machineText === 'plain') {
		rules.push('', '终端输出、日志、CSV、数据库字段、JSON/YAML 与代码字符串不经过 KaTeX 排版:保持可读纯文本,不要塞 `$...$`,也不要为排版破坏可执行内容。');
	} else {
		rules.push('', '机器可读文本(终端、日志、CSV、数据库字段、JSON/YAML)也按 LaTeX 写法输出。');
	}
	if (cfg.mode === 'lenient') {
		rules.push('', '宽松模式:基因、蛋白、药物名也允许 LaTeX 化(`$\\mathrm{p53}$`、`$\\mathrm{CD4}^+$`),但文件路径、命令、URL 仍不得包进公式。');
	}
	return rules.join('\n');
}

/** English policy body. */
function enRules(cfg) {
	const rules = [
		'## LaTeX formula policy (mandatory)',
		'',
		'Write every mathematical, statistical, physical and chemical expression in LaTeX so the renderer typesets it with KaTeX. Never fake a formula with ASCII (`10^-9`, `sqrt(x)`, `p<0.05`, `x/y`) or Unicode super/subscripts (`²`, `⁺`, `₀`).',
		'',
		'- Inline `$...$`; display `$$...$$` on its own line with blank lines around it',
		'- Multi-letter symbols in `\\mathrm{}`: `$\\mathrm{p}K_a$`, `$\\mathrm{pH}$`; chemical formulas `$\\mathrm{H_2O_2}$`, `$\\mathrm{Na^+}$` (KaTeX has no `\\ce{}`)',
		'- Values with units: `$10^{-9}\\ \\mathrm{M}$`, `$\\mathrm{mg\\,mL^{-1}}$`, `$37\\,^\\circ\\mathrm{C}$`; wrap prose inside math in `\\text{...}`',
		'- Same inside tables, lists and block quotes; write a literal dollar sign as `\\$`',
		'',
		'**Always LaTeX (quantities/expressions)**: equations, inequalities, fractions, roots, sums, integrals, derivatives; statistics (`$p$` value, `$n$`, `$r^2$`, `$95\\%\\ \\mathrm{CI}$`, `$\\mathrm{HR}$`, `$\\pm$`); quantity symbols and subscripts (`$K_d$`, `$K_M$`, `$V_{max}$`, `$k_{cat}$`, `$IC_{50}$`, `$EC_{50}$`, `$K_i$`, `$t_{1/2}$`, `$K_{eq}$`); thermodynamics (`$\\Delta G$`, `$\\Delta H$`, `$\\Delta S$`, `$E^\\circ$`); formulas/ions/isotopes (`$\\mathrm{CO_2}$`, `$\\mathrm{O_2^-}$`, `$^{14}\\mathrm{C}$`); exponents (`$10^{-6}$`, `$a_{ij}$`); instrument readings (`$A_{260}$`, `$\\mathrm{OD}_{600}$`, `$\\times g$`).',
		'',
		'**Keep plain text (names/identifiers)**: gene, protein, receptor, cell, drug and pathway names with their abbreviations (p53, CD4⁺, PD-1, CTLA-4, TGF-β, IL-2, TNF-α, IFN-γ, 5-FU, CYP3A4, MHC-I); sequences and variants (BRAF V600E, rs1234567); file names, paths, commands, code identifiers, URLs, DOIs, citations; ordinary counts, dates and version numbers.',
		'',
		'Decision rule: "names" stay plain text, "quantities/expressions" go LaTeX; when a token could be either, read the context — if it states a size, ratio, relation or unit, it is a quantity.',
		'',
		'- Formulas inside fenced code blocks are never typeset: do not put a formula that needs typesetting into a code block',
		'- During streaming the raw `$...$` shows first and typesets once the message settles — that is expected',
		'- Markdown files written to disk use LaTeX directly; `.docx`/`.pdf` do not typeset LaTeX — use an OMML/pandoc pipeline when needed and never pretend otherwise'
	];
	if (cfg.machineText === 'plain') {
		rules.push('', 'Terminal output, logs, CSV, database fields, JSON/YAML and code strings bypass KaTeX: keep them as readable plain text, do not inject `$...$`, and never break executable content for typesetting.');
	} else {
		rules.push('', 'Machine-readable text (terminal, logs, CSV, database fields, JSON/YAML) also uses LaTeX notation.');
	}
	if (cfg.mode === 'lenient') {
		rules.push('', 'Lenient mode: gene, protein and drug names may also be LaTeX (`$\\mathrm{p53}$`, `$\\mathrm{CD4}^+$`), but file paths, commands and URLs still never go inside math.');
	}
	return rules.join('\n');
}

/**
 * Render the prompt section for one config.
 * @param cfg - resolved config from {@link resolveConfig}.
 * @returns the section text.
 */
export function policyText(cfg) {
	const body = cfg.language === 'en' ? enRules(cfg) : zhRules(cfg);
	if (cfg.extra.length === 0) return body;
	const heading = cfg.language === 'en' ? '### Additional rules (from config)' : '### 附加规则(由配置追加)';
	return `${body}\n\n${heading}\n\n${cfg.extra}`;
}

/**
 * Register the policy section for the mounting context's scope.
 * @param ctx - plugin context; mounted at the profile root so the section is global.
 * @param config - loader config from the profile patch row.
 */
export function apply(ctx, config) {
	const cfg = resolveConfig(config, ctx);
	if (!cfg.enabled) return;
	ctx.effect(() => ctx.systemPrompt.section({
		name: SECTION_NAME,
		order: SECTION_ORDER,
		text: policyText(cfg)
	}), 'latex-math-policy.section()');
}
