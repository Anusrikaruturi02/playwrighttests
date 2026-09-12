/**
 * Logout Feature — Comprehensive Playwright Test Suite
 * Mapped to test case IDs from logout_test_scenarios.md
 *
 * Test Data (demo credentials):
 *   admin@talent.ai  / password123
 *   user@talent.ai   / test1234
 */

import { test, expect, request as pwRequest } from "@playwright/test";

const API = process.env.BASE_URL?.replace("3000", "8000") || "http://localhost:8000";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
async function loginViaUI(
  page: any,
  email    = "admin@talent.ai",
  password = "password123"
) {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit-btn").click();
  await page.waitForURL("**/dashboard", { timeout: 8000 });
}

async function loginViaAPI(
  apiCtx: any,
  email    = "admin@talent.ai",
  password = "password123"
): Promise<string> {
  const res  = await apiCtx.post(`${API}/api/login`, { data: { email, password } });
  const body = await res.json();
  return body.token as string;
}

// ────────────────────────────────────────────────────────────────
// 1. POSITIVE TEST SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("1. Positive Scenarios", () => {

  // TC-POS-001
  test("[TC-POS-001] Successful logout via Logout button", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  // TC-POS-002
  test("[TC-POS-002] Token is cleared from localStorage after logout", async ({ page }) => {
    await loginViaUI(page);

    const before = await page.evaluate(() => localStorage.getItem("token"));
    expect(before).not.toBeNull();

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    const after = await page.evaluate(() => localStorage.getItem("token"));
    expect(after).toBeNull();
  });

  // TC-POS-003
  test("[TC-POS-003] User can log in again after logout", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    await loginViaUI(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId("welcome-heading")).toBeVisible();
  });

  // TC-POS-004
  test("[TC-POS-004] Logout message shown before redirect", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("logout-message")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("logout-message")).toContainText(/logged out/i);
  });

  // TC-POS-005
  test("[TC-POS-005] Backend session invalidated on logout", async ({ request }) => {
    const token = await loginViaAPI(request);

    const logoutRes = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status()).toBe(200);

    const meRes = await request.get(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. NEGATIVE TEST SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("2. Negative Scenarios", () => {

  // TC-NEG-001
  test("[TC-NEG-001] Logout with invalid token returns 401", async ({ request }) => {
    const res = await request.post(`${API}/api/logout`, {
      headers: { Authorization: "Bearer invalidtoken999" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // TC-NEG-002
  test("[TC-NEG-002] Logout with no Authorization header returns 401", async ({ request }) => {
    const res = await request.post(`${API}/api/logout`);
    expect(res.status()).toBe(401);
  });

  // TC-NEG-003
  test("[TC-NEG-003] Accessing /dashboard without token redirects to login", async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  // TC-NEG-004
  test("[TC-NEG-004] Double-clicking Logout does not cause errors", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").dblclick();
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });
});

// ────────────────────────────────────────────────────────────────
// 3. UI & FUNCTIONAL SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("3. UI & Functional Scenarios", () => {

  // TC-UI-001
  test("[TC-UI-001] Logout button visible and labelled correctly in navbar", async ({ page }) => {
    await loginViaUI(page);
    const btn = page.getByTestId("logout-btn");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText("Logout");
  });

  // TC-UI-002
  test("[TC-UI-002] Logout button NOT present on login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("logout-btn")).toHaveCount(0);
  });

  // TC-UI-004
  test("[TC-UI-004] Login page renders correctly after logout redirect", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    await expect(page.getByTestId("login-heading")).toBeVisible();
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("login-submit-btn")).toBeVisible();
  });

  // TC-UI-005
  test("[TC-UI-005] Keyboard: Tab to logout button and press Enter", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });
});

// ────────────────────────────────────────────────────────────────
// 4. SESSION MANAGEMENT SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("4. Session Management", () => {

  // TC-SES-001
  test("[TC-SES-001] Backend session store removes token on logout", async ({ request }) => {
    const token = await loginViaAPI(request);

    await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meRes = await request.get(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(401);
  });

  // TC-SES-002
  test("[TC-SES-002] Session does not persist after page reload post-logout", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });
    await page.reload();
    await expect(page).toHaveURL(/login/);
  });

  // TC-SES-003
  test("[TC-SES-003] Logout of User A does not affect User B session", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaUI(pageA, "admin@talent.ai", "password123");
    await loginViaUI(pageB, "user@talent.ai",  "test1234");

    // Logout User A
    await pageA.getByTestId("logout-btn").click();
    await pageA.waitForURL("**/login", { timeout: 5000 });

    // User B should still be on dashboard
    await pageB.reload();
    await expect(pageB).toHaveURL(/dashboard/);
    await expect(pageB.getByTestId("welcome-heading")).toBeVisible();

    await ctxA.close();
    await ctxB.close();
  });

  // TC-SES-004
  test("[TC-SES-004] Both token and userName cleared from localStorage on logout", async ({ page }) => {
    await loginViaUI(page);

    const tokenBefore  = await page.evaluate(() => localStorage.getItem("token"));
    const nameBefore   = await page.evaluate(() => localStorage.getItem("userName"));
    expect(tokenBefore).not.toBeNull();
    expect(nameBefore).not.toBeNull();

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    const tokenAfter = await page.evaluate(() => localStorage.getItem("token"));
    const nameAfter  = await page.evaluate(() => localStorage.getItem("userName"));
    expect(tokenAfter).toBeNull();
    expect(nameAfter).toBeNull();
  });

  // TC-SES-005
  test("[TC-SES-005] Re-login after logout generates a new unique token", async ({ page }) => {
    await loginViaUI(page);
    const tokenA = await page.evaluate(() => localStorage.getItem("token"));

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    await loginViaUI(page);
    const tokenB = await page.evaluate(() => localStorage.getItem("token"));

    expect(tokenA).not.toBeNull();
    expect(tokenB).not.toBeNull();
    expect(tokenA).not.toBe(tokenB);
  });
});

// ────────────────────────────────────────────────────────────────
// 5. SECURITY SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("5. Security Scenarios", () => {

  // TC-SEC-001
  test("[TC-SEC-001] Old token cannot access protected API after logout", async ({ request }) => {
    const token = await loginViaAPI(request);

    await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await request.get(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });

  // TC-SEC-002
  test("[TC-SEC-002] Injecting old token into localStorage does not restore session", async ({ page, request }) => {
    const token = await loginViaAPI(request);

    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Manually re-inject the now-invalidated token
    await page.evaluate((t) => localStorage.setItem("token", t), token);
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  // TC-SEC-003
  test("[TC-SEC-003] GET /api/logout is not allowed (405 or 404)", async ({ request }) => {
    const res = await request.get(`${API}/api/logout`);
    expect([404, 405]).toContain(res.status());
  });

  // TC-SEC-006
  test("[TC-SEC-006] XSS payload in Authorization header does not crash server", async ({ request }) => {
    const res = await request.post(`${API}/api/logout`, {
      headers: { Authorization: "Bearer <script>alert(1)</script>" },
    });
    // Must return 401 — NOT 500
    expect(res.status()).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────
// 6. BROWSER BACK-BUTTON SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("6. Browser Back-Button Scenarios", () => {

  // TC-BACK-001
  test("[TC-BACK-001] Pressing Back after logout does not restore dashboard", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    await page.goBack();
    // Either stays on /login OR dashboard re-redirects to /login
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/login/);
  });

  // TC-BACK-003
  test("[TC-BACK-003] Forward button after re-login does not cause broken state", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    await loginViaUI(page);
    await page.goForward();
    await page.waitForTimeout(1000);
    // Should remain in dashboard area without crash
    await expect(page.getByTestId("logout-btn")).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 7. MULTIPLE-TAB SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("7. Multiple-Tab Scenarios", () => {

  // TC-TAB-002
  test("[TC-TAB-002] Refreshing Tab 2 after logout in Tab 1 redirects to login", async ({ browser }) => {
    const ctx   = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    // Both tabs share localStorage (same context)
    await loginViaUI(page1);
    await page2.goto("/dashboard");
    await page2.waitForURL("**/dashboard", { timeout: 5000 });

    // Logout from page1
    await page1.getByTestId("logout-btn").click();
    await page1.waitForURL("**/login", { timeout: 5000 });

    // Reload page2 — token is gone from shared localStorage
    await page2.reload();
    await page2.waitForURL("**/login", { timeout: 5000 });
    await expect(page2).toHaveURL(/login/);

    await ctx.close();
  });

  // TC-TAB-003
  test("[TC-TAB-003] New tab opened after logout cannot access dashboard", async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();

    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Open a new tab in same context (shared localStorage)
    const page2 = await ctx.newPage();
    await page2.goto("/dashboard");
    await page2.waitForURL("**/login", { timeout: 5000 });
    await expect(page2).toHaveURL(/login/);

    await ctx.close();
  });
});

// ────────────────────────────────────────────────────────────────
// 8. API LOGOUT SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("8. API Logout Scenarios", () => {

  // TC-API-001
  test("[TC-API-001] POST /api/logout returns 200 with goodbye message", async ({ request }) => {
    const token = await loginViaAPI(request);

    const res  = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.message).toMatch(/logged out/i);
    expect(body.message).toContain("Admin User");
  });

  // TC-API-002
  test("[TC-API-002] POST /api/logout with empty Bearer token returns 401", async ({ request }) => {
    const res = await request.post(`${API}/api/logout`, {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // TC-API-003
  test("[TC-API-003] Calling logout twice with same token — second call returns 401", async ({ request }) => {
    const token = await loginViaAPI(request);

    const first = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(first.status()).toBe(200);

    const second = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(second.status()).toBe(401);
  });

  // TC-API-004
  test("[TC-API-004] Public GET /api/jobs remains accessible after logout", async ({ request }) => {
    const token = await loginViaAPI(request);
    await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await request.get(`${API}/api/jobs`);
    expect(res.status()).toBe(200);
    const jobs = await res.json();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  // TC-API-005 (response time)
  test("[TC-API-005] POST /api/logout responds in < 500ms", async ({ request }) => {
    const token = await loginViaAPI(request);

    const start = Date.now();
    const res   = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });
});

// ────────────────────────────────────────────────────────────────
// 9. ERROR HANDLING SCENARIOS
// ────────────────────────────────────────────────────────────────
test.describe("9. Error Handling Scenarios", () => {

  // TC-ERR-001: Backend unavailable — logout still clears client state
  test("[TC-ERR-001] Backend unavailable — client still clears token and redirects", async ({ page }) => {
    await loginViaUI(page);

    // Abort the logout API call to simulate backend being down
    await page.route("**/api/logout", route => route.abort("connectionrefused"));

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Token must still be cleared client-side
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeNull();
  });

  // TC-ERR-002: Network timeout — UI handles gracefully
  test("[TC-ERR-002] Network timeout on logout — no UI freeze, token cleared", async ({ page }) => {
    await loginViaUI(page);

    // Simulate a very slow logout response
    await page.route("**/api/logout", async route => {
      await new Promise(r => setTimeout(r, 4000)); // delay 4s
      await route.abort("timedout");
    });

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page).toHaveURL(/login/);
  });

  // TC-ERR-003: Backend returns 500 — client still completes logout
  test("[TC-ERR-003] Backend 500 on logout — localStorage cleared, redirect happens", async ({ page }) => {
    await loginViaUI(page);

    await page.route("**/api/logout", route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Internal Server Error" }) })
    );

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// 10. BOUNDARY & EDGE CASES
// ────────────────────────────────────────────────────────────────
test.describe("10. Boundary & Edge Cases", () => {

  // TC-EDGE-001: Logout immediately after login
  test("[TC-EDGE-001] Logout immediately after login (< 1s)", async ({ page }) => {
    await loginViaUI(page);
    // No delay — click logout right away
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  // TC-EDGE-002: Very long token string
  test("[TC-EDGE-002] 10,000-char token does not crash server (returns 401)", async ({ request }) => {
    const longToken = "x".repeat(10_000);
    const res = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${longToken}` },
    });
    expect(res.status()).toBe(401);
  });

  // TC-EDGE-004: Concurrent logout requests
  test("[TC-EDGE-004] 5 concurrent logout requests — only 1 succeeds (200), rest return 401", async ({ request }) => {
    const token = await loginViaAPI(request);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${API}/api/logout`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.status())
      )
    );

    const successes = results.filter(s => s === 200);
    const failures  = results.filter(s => s === 401);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(4);
  });
});
