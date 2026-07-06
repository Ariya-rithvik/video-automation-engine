// ════════════════════════════════════════════════════════════════════════════
// WEB-LOGIN — shared, AI-free login helpers (pure DOM). Extracted from
// browser-recorder.ts so the deep-explorer and the recorder share ONE
// battle-tested implementation. Credentials are passed in at call time and are
// never logged or persisted.
// ════════════════════════════════════════════════════════════════════════════

import { Page } from 'puppeteer';
import * as path from 'path';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// URL fragments that mean "still on an auth page".
export const LOGIN_URL_PATTERNS = ['/login', '/signin', '/sign-in', '/auth', '/sso', 'accounts.', '/session/new', '/users/sign_in'];

/** Click the first visible element whose text/aria/title contains any keyword. Returns true if clicked. */
export async function clickByText(page: Page, keywords: string[]): Promise<boolean> {
  try {
    const r = await page.evaluate((kw) => {
      const els = Array.from(document.querySelectorAll('a,button,[role=button],[class*=btn],[class*=card],[class*=tool]')) as any[];
      const hit = els.find((e) => {
        const s = ((e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).trim().toLowerCase();
        return s && kw.some((k) => s.includes(k)) && e.offsetParent !== null;
      });
      if (!hit) return null;
      hit.scrollIntoView({ block: 'center' });
      const b = hit.getBoundingClientRect();
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), text: (hit.textContent || '').trim().slice(0, 30) };
    }, keywords);
    if (!r) return false;
    await page.mouse.click(r.x, r.y, { delay: 50 });
    console.log(`[WebLogin] clicked "${r.text}"`);
    await sleep(300);
    return true;
  } catch { return false; }
}

/** Heuristic: looks logged-in = not on an auth URL, no visible password field, real content present. */
export async function isLikelyLoggedIn(page: Page): Promise<boolean> {
  try {
    const url = page.url().toLowerCase();
    if (LOGIN_URL_PATTERNS.some((p) => url.includes(p))) return false;
    // Decide by EXPLICIT markers (works for SPAs AND avoids mistaking a content-rich PUBLIC landing for a
    // logged-in app): a "Logout / My account" control ⇒ logged in; visible "Sign in / Get started" CTAs (and
    // no logout) ⇒ still public. A password field ⇒ on the login form.
    const sig = await page.evaluate(() => {
      const hasPassword = !!document.querySelector('input[type="password"]');
      const txt = (document.body?.innerText || '').toLowerCase();
      const loggedIn = /log ?out|sign ?out|my account|my canvases|my profile/.test(txt);
      const signedOut = /\b(sign ?in|log ?in|sign ?up|get started|create (a |an )?(free )?account|start drawing free)\b/.test(txt);
      return { hasPassword, loggedIn, signedOut };
    });
    if (sig.hasPassword) return false;   // on the login form
    if (sig.loggedIn) return true;       // explicit signed-in marker (Logout / My Canvases)
    if (sig.signedOut) return false;     // public page still showing Sign in / Get started
    return false;                        // unknown → assume NOT logged in (so we attempt login, not skip it)
  } catch {
    return false;
  }
}

/**
 * Auto-login (fill credentials, no AI). If a login form isn't visible, click a "Sign in / Log in /
 * Get started" trigger to reveal it, then fill email + password and submit. Pure DOM — works without
 * any AI quota. Returns true when the round-trip looks successful. NOTE: Google OAuth / CAPTCHA pages
 * cannot be auto-filled (Google blocks automated browsers) → caller should fall back to manual login.
 * `opts.screenshotDir` (optional) saves a login-result.png for debugging; nothing is logged otherwise.
 */
export async function attemptAutoLogin(
  page: Page,
  creds: { username: string; password: string },
  opts?: { screenshotDir?: string },
): Promise<boolean> {
  try {
    const startUrl = page.url();
    const hasPw = () => page.evaluate(() => !!document.querySelector('input[type=password]'));

    if (!(await hasPw())) {
      // Tag likely auth triggers, then click them one-by-one until a password field appears.
      // CRITICAL: try LOGIN triggers ("sign in / log in") BEFORE signup ("sign up / get started"),
      // otherwise we reveal the SIGNUP form (extra required fields) and submit empty → "required".
      const count: number = await page.evaluate(() => {
        const loginKw = ['sign in', 'log in', 'login', 'signin'];
        const signupKw = ['sign up', 'signup', 'get started', 'start free', 'create account', 'create free account', 'register'];
        const els = Array.from(document.querySelectorAll('a,button,[role=button]')) as any[];
        const scored: { el: any; score: number }[] = [];
        els.forEach((e) => {
          const t = (e.textContent || '').trim().toLowerCase();
          if (!t || e.offsetParent === null) return;
          if (loginKw.some((k) => t.includes(k))) scored.push({ el: e, score: 0 });
          else if (signupKw.some((k) => t.includes(k))) scored.push({ el: e, score: 1 });
        });
        scored.sort((a, b) => a.score - b.score); // login triggers first
        scored.forEach((s, i) => s.el.setAttribute('data-ade-trig', String(i)));
        return scored.length;
      });
      for (let i = 0; i < count; i++) {
        await page.evaluate((idx) => { const el = document.querySelector('[data-ade-trig="' + idx + '"]') as any; if (el) el.click(); }, i);
        await sleep(1800);
        if (await hasPw()) break;
      }
    }
    if (!(await hasPw())) { console.warn('[WebLogin] auto-login: no login form found after triggers'); return false; }

    // The auth UI often renders LOGIN and SIGNUP forms TOGETHER. Blindly picking the first password
    // sometimes grabs SIGNUP → empty-submit "required". So SCORE each visible password's form and tag
    // the LOGIN one's email + password + submit. This is what makes auto-login deterministic.
    const tagLoginForm = () => page.evaluate(() => {
      const vis = (el: any) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const notSearch = (e: any) => !/search/i.test((e.placeholder || '') + (e.getAttribute('aria-label') || '') + (e.name || ''));
      const scopeOf = (el: any) => el.closest('form') || el.closest('[class*=modal],[class*=dialog],[class*=card],[class*=auth],[class*=login],[role=dialog]') || document.body;
      const pws = (Array.from(document.querySelectorAll('input[type=password]')) as any[]).filter(vis);
      if (!pws.length) return { ok: false };
      const scored = pws.map((pw) => {
        const scope: any = scopeOf(pw);
        const txt = (scope.innerText || '').toLowerCase();
        const ph = (pw.placeholder || '').toLowerCase();
        const hasHandle = (Array.from(scope.querySelectorAll('input[type=text]')) as any[]).some((t) => vis(t) && notSearch(t)); // username field ⇒ signup
        let score = 0;
        if (/sign in|log ?in|welcome back|forgot password/.test(txt)) score += 2;
        if (/create (an |your )?account|sign ?up|free forever|cool_creator|full name|confirm password/.test(txt)) score -= 2;
        if (hasHandle) score -= 3;
        if (/strong|create/.test(ph)) score -= 2;   // "Strong password" ⇒ signup
        if (/\*{3,}|password/.test(ph)) score += 1;  // "********" ⇒ login
        return { pw, scope, score };
      }).sort((a, b) => b.score - a.score);
      const best = scored[0];
      const scope = best.scope;
      const emailSel = 'input[type=email],input[name*=email i],input[id*=email i],input[autocomplete=username],input[type=text],input:not([type])';
      const email = (Array.from(scope.querySelectorAll(emailSel)) as any[]).filter(vis).filter(notSearch)[0];
      if (email) email.setAttribute('data-ade-email', '1');
      best.pw.setAttribute('data-ade-pass', '1');
      const btns = (Array.from(scope.querySelectorAll('button,[type=submit],[role=button]')) as any[]).filter((b) => b.offsetParent !== null);
      let sub: any = btns.find((b) => /^(sign in|log ?in)$/.test((b.textContent || '').trim().toLowerCase()));
      if (!sub) sub = btns.find((b) => { const t = (b.textContent || '').trim().toLowerCase(); return /sign in|log ?in/.test(t) && !/sign ?up|create|free/.test(t); });
      if (!sub) sub = btns.find((b) => (b.getAttribute('type') || '').toLowerCase() === 'submit');
      if (sub) sub.setAttribute('data-ade-submit', '1');
      return { ok: true, email: !!email, score: best.score, submit: sub ? (sub.textContent || '').trim().slice(0, 24) : null };
    });

    let info: any = await tagLoginForm();
    // If the best candidate still looks like SIGNUP (negative score), click the "Already have an
    // account? / Sign in" toggle to switch to the login form, then re-tag.
    if (!info.ok || info.score < 0) {
      const toggled = await page.evaluate(() => {
        const link = (Array.from(document.querySelectorAll('a,button,[role=button],span,p')) as any[])
          .find((a) => { const t = (a.textContent || '').trim().toLowerCase(); return /(already have an account|^sign in$|^log ?in$|sign in instead|log ?in instead)/.test(t) && t.length < 40 && a.offsetParent !== null; });
        if (link) { link.click(); return true; }
        return false;
      });
      if (toggled) {
        console.log('[WebLogin] auto-login: toggled → login form');
        await sleep(1500);
        await page.evaluate(() => { document.querySelectorAll('[data-ade-email],[data-ade-pass],[data-ade-submit]').forEach((e) => { e.removeAttribute('data-ade-email'); e.removeAttribute('data-ade-pass'); e.removeAttribute('data-ade-submit'); }); });
        info = await tagLoginForm();
      }
    }
    if (!info.ok) { console.warn('[WebLogin] auto-login: could not isolate a login form'); return false; }
    console.log(`[WebLogin] auto-login: login form chosen (score=${info.score}, submit="${info.submit || 'n/a'}")`);
    const found = { u: info.email, p: true };
    // Fill with READ-BACK VERIFY + retry. React controlled inputs can silently drop el.value on
    // re-render, leaving the field empty at submit ("required"). After typing we read input.value
    // back; if it didn't stick, select-all + delete + retype (up to 3×).
    const fillVerified = async (sel: string, val: string): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.click(sel).catch(() => {});
        await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace').catch(() => {});
        await page.type(sel, val, { delay: 30 });
        await sleep(180);
        const got = await page.evaluate((s) => { const el = document.querySelector(s) as any; return el ? String(el.value || '') : ''; }, sel);
        if (got === val) return true;
      }
      return false;
    };
    if (found.u) {
      const okU = await fillVerified('[data-ade-email]', creds.username);
      if (!okU) console.warn('[WebLogin] auto-login: email field did not retain value');
    }
    const okP = await fillVerified('[data-ade-pass]', creds.password);
    if (!okP) { console.warn('[WebLogin] auto-login: password field did not retain value — aborting submit'); return false; }
    await sleep(400);

    // Click the LOGIN form's submit (tagged data-ade-submit). Re-read coords after fill (layout shifts).
    const submit = await page.evaluate(() => {
      let hit: any = document.querySelector('[data-ade-submit]');
      if (!hit) {
        const pEl = document.querySelector('[data-ade-pass]') || document.querySelector('input[type=password]');
        const scope: any = pEl ? (pEl.closest('form') || pEl.closest('[class*=modal],[class*=dialog],[class*=card],[class*=auth],[class*=login],[role=dialog]') || document.body) : document.body;
        const btns = (Array.from(scope.querySelectorAll('button,[type=submit],[role=button]')) as any[]).filter((b) => b.offsetParent !== null);
        hit = btns.find((b) => { const t = (b.textContent || '').trim().toLowerCase(); return /sign in|log ?in/.test(t) && !/sign ?up|create|free/.test(t); })
           || btns.find((b) => (b.getAttribute('type') || '').toLowerCase() === 'submit');
      }
      if (!hit) return null;
      hit.scrollIntoView({ block: 'center' });
      const r = hit.getBoundingClientRect();
      return { text: (hit.textContent || '').trim().slice(0, 30), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    if (submit) {
      await sleep(300);
      await page.mouse.click(submit.x, submit.y, { delay: 60 });
      console.log(`[WebLogin] auto-login: clicked submit "${submit.text}"`);
    } else {
      await page.keyboard.press('Enter').catch(() => {});
      console.log('[WebLogin] auto-login: no submit button found, pressed Enter');
    }
    // Auth round-trip can take a while ("Signing In…"). POLL for success up to ~22s. Success =
    // navigated off login OR the form is gone and the page looks logged-in.
    let ok = false;
    for (let i = 0; i < 45; i++) { // poll up to ~45s — CollabCanvas auth ("Signing In…") is genuinely slow (~37s seen)
      await sleep(1000);
      const navigated = page.url() !== startUrl && !/\/login|\/signin|\/sign-in|\/auth/i.test(page.url());
      if (navigated) { ok = true; break; }
      const formGone = await page.evaluate(() => !document.querySelector('input[type=password]')).catch(() => false);
      if (formGone && await isLikelyLoggedIn(page)) { ok = true; break; }
      // Bail early on a REAL credential error (scoped to the modal).
      const err = await page.evaluate(() => {
        const pw = document.querySelector('[data-ade-pass]') || document.querySelector('input[type=password]');
        const scope: any = pw ? (pw.closest('form') || pw.closest('[class*=modal],[class*=dialog],[class*=card],[class*=auth]') || document.body) : document.body;
        const t = (scope.innerText || '').toLowerCase();
        const m = t.match(/(invalid|incorrect|wrong password|user not found|does ?n.?t exist|no account|account not found|try again)[^\n]{0,60}/i);
        return m ? m[0].trim() : '';
      }).catch(() => '');
      if (err) { console.log('[WebLogin] auto-login credential error:', err); break; }
    }
    if (opts?.screenshotDir) {
      try { await page.screenshot({ path: path.join(opts.screenshotDir, 'login-result.png') as `${string}.png`, fullPage: false }); } catch { /* ignore */ }
    }
    console.log(`[WebLogin] auto-login ${ok ? 'succeeded' : 'uncertain'} → ${page.url()}`);
    return ok;
  } catch (e) {
    console.warn(`[WebLogin] auto-login error: ${(e as Error).message}`);
    return false;
  }
}
