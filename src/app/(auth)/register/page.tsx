'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from '../auth.module.css'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function RegisterPage() {
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { t } = useLanguage()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (password !== confirmPassword) {
            setError(t('error.passwordMismatch'))
            return
        }

        if (password.length < 6) {
            setError(t('error.passwordShort'))
            return
        }

        if (!displayName.trim()) {
            setError(t('error.displayNameRequired'))
            return
        }

        setLoading(true)

        const supabase = createClient()
        const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName.trim(),
                },
            },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
            return
        }

        setSuccess(t('success.accountCreated'))
        setTimeout(() => router.push('/family'), 1500)
    }

    return (
        <main className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authLogo}>
                    <div className={styles.authLogoIcon}>📅</div>
                    <span className={styles.authLogoText}>{t('app.title')}</span>
                </div>

                <h1 className={styles.authTitle}>{t('auth.register.title')}</h1>
                <p className={styles.authSubtitle}>{t('auth.register.subtitle')}</p>

                {error && <div className={styles.errorMsg}>{error}</div>}
                {success && <div className={styles.successMsg}>{success}</div>}

                <form onSubmit={handleRegister}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="displayName">{t('auth.displayName.label')}</label>
                        <input
                            id="displayName"
                            className={styles.formInput}
                            type="text"
                            placeholder={t('auth.displayName.placeholder')}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                        />
                    </div>

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
                            placeholder={t('auth.password.placeholder.register')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="confirmPassword">{t('auth.confirmPassword.label')}</label>
                        <input
                            id="confirmPassword"
                            className={styles.formInput}
                            type="password"
                            placeholder={t('auth.confirmPassword.placeholder')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? t('auth.register.loading') : t('auth.register.button')}
                    </button>
                </form>

                <p className={styles.authFooter}>
                    {t('auth.register.footer')} <Link href="/login">{t('auth.register.link')}</Link>
                </p>
            </div>
        </main>
    )
}
