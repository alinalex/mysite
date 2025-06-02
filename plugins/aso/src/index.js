import fixes from './fixes.js';

function findByString(str) {
  const tag = str.match(/^<(\S+)/)[1];
  const attrs = str.match(/([^\s="]+="[^"]+")|([^\s=']+='[^']+')/g);
  const q = tag + attrs.map((t) => `[${t}]`).join('');
  return q;
}

function loadFixesForPage() {
  const fixesForPage = fixes[window.location.href];
  if (fixesForPage) {
    fixesForPage.fixes.forEach((fix) => {
      const querySelector = fix.targetHTML || findByString(fix.brokenHTML);
      const el = window.document.querySelector(querySelector);
      if (el) {
        if (fix.type === 'addAttribute') {
          el.setAttribute(fix.attribute, fix.value);
        } else if (fix.type === 'removeAttribute') {
          el.removeAttribute(fix.attribute);
        }
      }
    });
  }
}

export function loadFixes() {
  window.setTimeout(() => loadFixesForPage(), 1000);
}

export default {
  loadFixes,
};
