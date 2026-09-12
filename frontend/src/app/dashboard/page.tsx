"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

interface UserInfo {
  name: string;
  email: string;
  loginAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]       = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutMsg, setLogoutMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: UserInfo) => setUser(data))
      .catch(() => { localStorage.removeItem("token"); router.push("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    const token = localStorage.getItem("token");

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/logout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch { /* swallow — still clear local state */ }

    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    setLogoutMsg("You have been logged out. Redirecting…");
    setTimeout(() => router.push("/login"), 1500);
  }

  if (loading) return <div className={styles.loading} data-testid="loading">Loading…</div>;

  return (
    <main className={styles.main}>
      <nav className={styles.navbar} data-testid="navbar">
        <span className={styles.brand}>🚀 AI Talent Acquisition</span>
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          data-testid="logout-btn"
        >
          Logout
        </button>
      </nav>

      <section className={styles.content}>
        {logoutMsg ? (
          <p className={styles.logoutMsg} data-testid="logout-message">{logoutMsg}</p>
        ) : (
          <>
            <h1 className={styles.heading} data-testid="welcome-heading">
              Welcome, {user?.name}! 👋
            </h1>
            <p className={styles.subtext} data-testid="user-email">
              Logged in as <strong>{user?.email}</strong>
            </p>
            <p className={styles.subtext} data-testid="login-time">
              Session started: {user?.loginAt ? new Date(user.loginAt).toLocaleString() : "—"}
            </p>

            <div className={styles.cards}>
              <div className={styles.card} data-testid="dashboard-card">
                <span>💼</span>
                <h3>4 Jobs Available</h3>
                <p>Browse the latest openings.</p>
              </div>
              <div className={styles.card} data-testid="dashboard-card">
                <span>📄</span>
                <h3>Your Profile</h3>
                <p>Keep your resume up to date.</p>
              </div>
              <div className={styles.card} data-testid="dashboard-card">
                <span>🔔</span>
                <h3>Alerts</h3>
                <p>No new notifications.</p>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
