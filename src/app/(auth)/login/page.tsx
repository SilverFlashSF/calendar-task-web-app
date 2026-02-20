'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from '../auth.module.css'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { t } = useLanguage()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (signInError) {
            setError(signInError.message)
            setLoading(false)
            return
        }

        router.push('/calendar')
        router.refresh()
    }

    return (
        <main className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authLogo}>
                    <div className={styles.authLogoIcon}>📅</div>
                    <span className={styles.authLogoText}>{t('app.title')}</span>
                </div>

                <h1 className={styles.authTitle}>{t('auth.login.title')}</h1>
                <p className={styles.authSubtitle}>{t('auth.login.subtitle')}</p>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="email">{t('auth.email.label')}</label>
                        <input
                            id="email"
                            className={styles.formInput}
                            type="email"
                            placeholder={t('auth.email.placeholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="password">{t('auth.password.label')}</label>
                        <input
                            id="password"
                            className={styles.formInput}
                            type="password"
                            placeholder={t('auth.password.placeholder.login')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? t('auth.login.loading') : t('action.signIn')}
                    </button>
                </form>

                <p className={styles.authFooter}>
                    {t('auth.login.footer')} <Link href="/register">{t('auth.login.link')}</Link>
                </p>
            </div>
        </main>
    )
}
