'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User, Family } from '@/lib/types'
import styles from './app.module.css'

import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { t } = useLanguage()
    const [user, setUser] = useState<User | null>(null)
    const [family, setFamily] = useState<Family | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        loadUserData()
    }, [])

    const loadUserData = async () => {
        try {
            const supabase = createClient()
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/login')
                return
            }

            // Derive display name from auth metadata
            const authDisplayName = authUser.user_metadata?.display_name
                || authUser.email?.split('@')[0]
                || 'User'
            const authEmail = authUser.email || ''

            const { data: initialProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            let profile = initialProfile

            console.log('[Layout] profile:', JSON.stringify(profile), 'error:', JSON.stringify(profileError))

            if (profileError && profileError.code === 'PGRST116') {
                // Profile doesn't exist at all — create it
                console.log('[Layout] Creating new profile...')
                const { data: newProfile, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: authUser.id,
                        email: authEmail,
                        display_name: authDisplayName,
                    })
                    .select()
                    .single()
                console.log('[Layout] insert result:', JSON.stringify(newProfile), 'error:', JSON.stringify(insertError))
                if (newProfile) profile = newProfile
            } else if (profile && (!profile.email || !profile.display_name)) {
                // Profile exists but has empty fields — update them
                console.log('[Layout] Patching empty profile fields...')
                const updates: Record<string, string> = {}
                if (!profile.email) updates.email = authEmail
                if (!profile.display_name) updates.display_name = authDisplayName
                const { data: updatedProfile, error: updateError } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', authUser.id)
                    .select()
                    .single()
                console.log('[Layout] update result:', JSON.stringify(updatedProfile), 'error:', JSON.stringify(updateError))
                if (updatedProfile) profile = updatedProfile
            }

            if (profile) {
                setUser(profile)

                if (profile.family_id) {
                    const { data: familyData } = await supabase
                        .from('families')
                        .select('*')
                        .eq('id', profile.family_id)
                        .single()

                    if (familyData) setFamily(familyData)
                } else {
                    router.push('/family')
                    return
                }
            }
        } catch (err) {
            console.error('loadUserData error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            </div>
        )
    }

    const navItems = [
        { path: '/calendar', icon: '📅', label: t('nav.calendar') },
        { path: '/tasks', icon: '✅', label: t('nav.tasks') },
        { path: '/notifications', icon: '🔔', label: t('nav.notifications') },
        { path: '/settings', icon: '⚙️', label: t('nav.settings') },
    ]

    return (
        <div className={styles.appLayout}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.sidebarLogoIcon}>📅</div>
                    <span className={styles.sidebarLogoText}>{t('app.title')}</span>
                </div>

                <nav className={styles.sidebarNav}>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`${styles.navItem} ${pathname.startsWith(item.path) ? styles.navItemActive : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    {family && (
                        <div className={styles.familyInfo}>
                            <span>👨‍👩‍👧‍👦</span>
                            <span className={styles.familyName}>{family.name}</span>
                            <span className={styles.familyCode}>{family.join_code}</span>
                        </div>
                    )}
                    <div className={styles.userInfo}>
                        <div className={styles.userAvatar}>
                            {user?.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt={user.display_name || 'Avatar'}
                                    className={styles.userAvatarImg}
                                />
                            ) : (
                                user?.display_name?.charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <span className={styles.userName}>{user?.display_name || 'User'}</span>
                        <button onClick={handleLogout} className={styles.logoutBtn}>
                            {t('action.signOut')}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    )
}
