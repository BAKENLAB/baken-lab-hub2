import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = [
  'index.html', 'today.html', 'result.html', 'next.html',
  'course.html', 'blood.html', 'jockey.html', 'value.html', 'bet.html',
];
const excluded = ['login.html', 'oauth/consent/index.html'];
const script = '<script defer src="/_vercel/insights/script.js"></script>';
const shim = 'window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };';

for (const path of pages) {
  test(`Web Analytics loads once in public content page ${path}`, () => {
    const html = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.equal(html.split(script).length - 1, 1, 'one external script');
    assert.equal(html.split(shim).length - 1, 1, 'one va queue shim');
    assert.ok(html.indexOf('<head>') < html.indexOf(shim), 'shim is inside head');
    assert.ok(html.indexOf(shim) < html.indexOf(script), 'shim loads before script');
    assert.ok(html.indexOf(script) < html.indexOf('</head>'), 'script is inside head');
  });
}
for (const path of excluded) {
  test(`Sensitive page ${path} is not tracked`, () => {
    const html = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.equal(html.includes('/_vercel/insights/script.js'), false);
    assert.equal(html.includes('window.va ='), false);
  });
}
