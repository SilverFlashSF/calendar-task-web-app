'use client';

import Link from "next/link";
import styles from "./page.module.css";
import { useLanguage } from "@/lib/contexts/LanguageContext";

export default function Home() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <main className={styles.landing}>
      {/* Language Switcher */}
      <div className={styles.languageSwitcher}>
        <button
          onClick={() => setLanguage(language === 'en' ? 'my' : 'en')}
          className={styles.languageBtn}
        >
          {language === 'en' ? '🇺🇸 English' : '🇲🇲 ဗမာ'}
        </button>
      </div>

      <div className={styles.hero}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>📅</div>
          <h1 className={styles.logoText}>{t('app.title')}</h1>
        </div>

        <p className={styles.subtitle}>
          {t('hero.subtitle')}
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>✅</div>
            <div className={styles.featureTitle}>{t('feature.sharedTasks.title')}</div>
            <div className={styles.featureDesc}>
              {t('feature.sharedTasks.desc')}
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔔</div>
            <div className={styles.featureTitle}>{t('feature.smartReminders.title')}</div>
            <div className={styles.featureDesc}>
              {t('feature.smartReminders.desc')}
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>💬</div>
            <div className={styles.featureTitle}>{t('feature.comments.title')}</div>
            <div className={styles.featureDesc}>
              {t('feature.comments.desc')}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/register" className={styles.btnPrimary}>
            {t('action.getStarted')}
          </Link>
          <Link href="/login" className={styles.btnSecondary}>
            {t('action.signIn')}
          </Link>
        </div>

        <div className={styles.priorityDemo}>
          <span className={styles.priorityPill}>
            <span className="priority-dot red"></span> {t('priority.high')}
          </span>
          <span className={styles.priorityPill}>
            <span className="priority-dot yellow"></span> {t('priority.medium')}
          </span>
          <span className={styles.priorityPill}>
            <span className="priority-dot green"></span> {t('priority.low')}
          </span>
        </div>
      </div>
    </main>
  );
}
