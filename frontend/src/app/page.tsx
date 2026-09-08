import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      {/* ── Hero ── */}
      <section className={styles.hero} data-testid="hero">
        <h1 className={styles.heading} data-testid="main-heading">
          🚀 AI Talent Acquisition
        </h1>
        <p className={styles.subheading} data-testid="subheading">
          Connecting the right talent with the right opportunity — powered by AI.
        </p>
        <div className={styles.cta}>
          <a href="/jobs" className={styles.btnPrimary} data-testid="browse-jobs-btn">
            Browse Jobs
          </a>
          <a href="/login" className={styles.btnSecondary} data-testid="login-btn">
            Login
          </a>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features} data-testid="features-section">
        <h2>Why Choose Us?</h2>
        <div className={styles.cards}>
          <div className={styles.card} data-testid="feature-card">
            <span>🤖</span>
            <h3>AI-Powered Matching</h3>
            <p>Smart algorithms match your skills to the best roles instantly.</p>
          </div>
          <div className={styles.card} data-testid="feature-card">
            <span>⚡</span>
            <h3>Fast Hiring</h3>
            <p>Get hired up to 3× faster than traditional job boards.</p>
          </div>
          <div className={styles.card} data-testid="feature-card">
            <span>🌍</span>
            <h3>Remote Friendly</h3>
            <p>Thousands of remote-first opportunities worldwide.</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer} data-testid="footer">
        <p>© 2026 AI Talent Acquisition. All rights reserved.</p>
      </footer>
    </main>
  );
}
