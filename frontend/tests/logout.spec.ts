import { test, expect } from "@playwright/test";

const API = process.env.BASE_URL?.replace("3000", "8000") || "http://localhost:8000";

// ── helpers ─────────────────────────────────────────────────────
async function loginViaUI(page: any, email = "admin@talent.ai", password = "password123") {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit-btn").click();
  await page.waitForURL("**/dashboard");
}

// ── Login page tests ─────────────────────────────────────────────
test.describe("Login Page", () => {
  test("renders login form correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-heading")).toBeVisible();
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("login-submit-btn")).toBeVisible();
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("email-input").fill("wrong@example.com");
    await page.getByTestId("password-input").fill("wrongpass");
    await page.getByTestId("login-submit-btn").click();
    await expect(page.getByTestId("error-message")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("error-message")).toContainText(/invalid/i);
  });

  test("redirects to dashboard on valid login", async ({ page }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId("welcome-heading")).toBeVisible();
    await expect(page.getByTestId("welcome-heading")).toContainText("Admin User");
  });
});

// ── Dashboard tests ──────────────────────────────────────────────
test.describe("Dashboard", () => {
  test("shows user info after login", async ({ page }) => {
    await loginViaUI(page);
    await expect(page.getByTestId("user-email")).toContainText("admin@talent.ai");
    await expect(page.getByTestId("login-time")).toBeVisible();
  });

  test("displays 3 dashboard cards", async ({ page }) => {
    await loginViaUI(page);
    await expect(page.getByTestId("dashboard-card")).toHaveCount(3);
  });

  test("logout button is visible in navbar", async ({ page }) => {
    await loginViaUI(page);
    await expect(page.getByTestId("navbar")).toBeVisible();
    await expect(page.getByTestId("logout-btn")).toBeVisible();
  });

  test("redirects to login if not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });
});

// ── Logout flow tests ────────────────────────────────────────────
test.describe("Logout Feature", () => {
  test("clicking logout shows goodbye message", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await expect(page.getByTestId("logout-message")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("logout-message")).toContainText(/logged out/i);
  });

  test("redirects to login page after logout", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test("clears token from localStorage on logout", async ({ page }) => {
    await loginViaUI(page);
    // Verify token exists before logout
    const tokenBefore = await page.evaluate(() => localStorage.getItem("token"));
    expect(tokenBefore).not.toBeNull();

    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Token should be gone
    const tokenAfter = await page.evaluate(() => localStorage.getItem("token"));
    expect(tokenAfter).toBeNull();
  });

  test("cannot access dashboard after logout", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Try to navigate back to dashboard
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test("can log in again after logout", async ({ page }) => {
    await loginViaUI(page);
    await page.getByTestId("logout-btn").click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Log back in
    await loginViaUI(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId("welcome-heading")).toBeVisible();
  });
});

// ── Backend API tests ────────────────────────────────────────────
test.describe("Logout API", () => {
  test("POST /api/logout returns 401 for invalid token", async ({ request }) => {
    const res = await request.post(`${API}/api/logout`, {
      headers: { Authorization: "Bearer invalidtoken123" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("POST /api/login + /api/logout full cycle", async ({ request }) => {
    // Login
    const loginRes = await request.post(`${API}/api/login`, {
      data: { email: "user@talent.ai", password: "test1234" },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();
    expect(token).toBeTruthy();

    // Logout
    const logoutRes = await request.post(`${API}/api/logout`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status()).toBe(200);
    const body = await logoutRes.json();
    expect(body.message).toContain("logged out");

    // Token is now invalid
    const meRes = await request.get(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status()).toBe(401);
  });
});
