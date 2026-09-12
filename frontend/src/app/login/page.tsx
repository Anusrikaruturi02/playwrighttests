"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.name);
      router.push("/dashboard");
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card} data-testid="login-card">
        <h1 className={styles.title} data-testid="login-heading">
          🔐 Sign In
        </h1>
        <p className={styles.subtitle}>Welcome back to AI Talent Acquisition</p>

        <form onSubmit={handleSubmit} className={styles.form} data-testid="login-form">
          <label className={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@talent.ai"
              className={styles.input}
              data-testid="email-input"
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              data-testid="password-input"
              required
            />
          </label>

          {error && (
            <p className={styles.error} data-testid="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.btn}
            data-testid="login-submit-btn"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className={styles.hint}>
          Demo credentials: <code>admin@talent.ai</code> / <code>password123</code>
        </p>
      </div>
    </main>
  );
}
