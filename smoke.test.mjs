import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, inject, name, policyText, resolveConfig } from '../lib/index.js';

/** Minimal stand-in for the Cordis context surface this plugin touches. */
function makeCtx() {
	const sections = [];
	return {
		sections,
		systemPrompt: {
			section(section) {
				sections.push(section);
				return () => {};
			}
		},
		effect(callback) {
			return callback();
		},
		logger: { warn() {} }
	};
}

test('exports the plugin contract', () => {
	assert.equal(name, 'dsh-plugin-latex-math');
	assert.deepEqual(inject, ['systemPrompt']);
});

test('registers one global prompt section by default', () => {
	const ctx = makeCtx();
	apply(ctx, undefined);
	assert.equal(ctx.sections.length, 1);
	const [section] = ctx.sections;
	assert.equal(section.name, 'plugin:latex-math-policy');
	assert.equal(section.order, 400);
	assert.match(section.text, /\$\.\.\.\$/);
	assert.match(section.text, /禁止用 ASCII 伪数学/);
	assert.match(section.text, /p53/);
});

test('stays silent when disabled', () => {
	const ctx = makeCtx();
	apply(ctx, { enabled: false });
	assert.equal(ctx.sections.length, 0);
});

test('renders English rules when asked', () => {
	const ctx = makeCtx();
	apply(ctx, { language: 'en' });
	const [section] = ctx.sections;
	assert.match(section.text, /LaTeX formula policy/);
	assert.match(section.text, /ASCII/);
});

test('lenient mode allows LaTeX names but keeps machine text plain', () => {
	const cfg = resolveConfig({ mode: 'lenient' });
	const text = policyText(cfg);
	assert.match(text, /宽松模式/);
	assert.match(text, /数据库字段/);
});

test('invalid values fall back to defaults instead of throwing', () => {
	const warnings = [];
	const ctx = { logger: { warn: (line) => warnings.push(line) } };
	const cfg = resolveConfig({ mode: 'nonsense', language: 'xx', machineText: 'maybe' }, ctx);
	assert.equal(cfg.mode, 'strict');
	assert.equal(cfg.language, 'zh');
	assert.equal(cfg.machineText, 'plain');
	assert.equal(warnings.length, 3);
});

test('extra rules are appended under their own heading', () => {
	const cfg = resolveConfig({ extra: '  引用文献时保留原始编号  ' });
	const text = policyText(cfg);
	assert.match(text, /### 附加规则\(由配置追加\)/);
	assert.match(text, /引用文献时保留原始编号/);
});

test('machineText latex switches the machine-facing clause', () => {
	const plain = policyText(resolveConfig({ machineText: 'plain' }));
	const latex = policyText(resolveConfig({ machineText: 'latex' }));
	assert.match(plain, /不经过 KaTeX 排版/);
	assert.match(latex, /也按 LaTeX 写法输出/);
});
