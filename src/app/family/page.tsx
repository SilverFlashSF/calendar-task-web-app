'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './family.module.css'
import type { User } from '@supabase/supabase-js'

export default function FamilyPage() {
    const [mode, setMode] = useState<'create' | 'join'>('create')
    const [familyName, setFamilyName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setCurrentUser(session.user)
            } else {
                const { data: { user } } = await supabase.auth.getUser()
                setCurrentUser(user)
            }
        }

        checkUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session?.user) {
                    setCurrentUser(session.user)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!familyName.trim()) {
            setError('Family name is required')
            return
        }

        setLoading(true)

        if (!currentUser) {
            setError('You must be signed in')
            setLoading(false)
            return
        }

        // Create family
        const { data: family, error: createError } = await supabase
            .from('families')
            .insert({ name: familyName.trim(), created_by: currentUser.id })
            .select()
            .single()

        if (createError) {
            setError(createError.message)
            setLoading(false)
            return
        }

        // Add self as member
        const { error: memberError } = await supabase
            .from('family_members')
            .insert({ family_id: family.id, user_id: currentUser.id })

        if (memberError) {
            setError(memberError.message)
            setLoading(false)
            return
        }

        // Update user's family_id
        await supabase
            .from('users')
            .update({ family_id: family.id })
            .eq('id', currentUser.id)

        setSuccess('Family created! Redirecting...')
        setTimeout(() => {
            router.push('/calendar')
            router.refresh()
        }, 1000)
    }

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!joinCode.trim()) {
            setError('Join code is required')
            return
        }

        setLoading(true)

        if (!currentUser) {
            setError('You must be signed in to join a family.')
            setLoading(false)
            return
        }

        // Find family by join code
        const { data: family, error: findError } = await supabase
            .from('families')
            .select()
            .eq('join_code', joinCode.trim())
            .single()

        if (findError || !family) {
            setError('Invalid join code. Please check and try again.')
            setLoading(false)
            return
        }

        // Add self as member
        const { error: memberError } = await supabase
            .from('family_members')
            .insert({ family_id: family.id, user_id: currentUser.id })

        if (memberError) {
            if (memberError.code === '23505') {
                setError('You are already a member of this family')
            } else {
                setError(memberError.message)
            }
            setLoading(false)
            return
        }

        // Update user's family_id
        await supabase
            .from('users')
            .update({ family_id: family.id })
            .eq('id', currentUser.id)

        setSuccess(`Joined "${family.name}"! Redirecting...`)
        setTimeout(() => {
            router.push('/calendar')
            router.refresh()
        }, 1000)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    return (
        <main className={styles.familyPage}>
            <div className={styles.familyCard}>
                <button onClick={handleLogout} className={styles.logoutBtn}>
                    Sign Out
                </button>

                <h1 className={styles.familyTitle}>👨‍👩‍👧‍👦 Your Family</h1>
                <p className={styles.familySubtitle}>
                    Create a new family or join an existing one
                </p>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${mode === 'create' ? styles.tabActive : ''}`}
                        onClick={() => { setMode('create'); setError(''); setSuccess('') }}
                    >
                        Create Family
                    </button>
                    <button
                        className={`${styles.tab} ${mode === 'join' ? styles.tabActive : ''}`}
                        onClick={() => { setMode('join'); setError(''); setSuccess('') }}
                    >
                        Join Family
                    </button>
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}
                {success && <div className={styles.successMsg}>{success}</div>}

                {mode === 'create' ? (
                    <form onSubmit={handleCreate}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel} htmlFor="familyName">Family Name</label>
                            <input
                                id="familyName"
                                className={styles.formInput}
                                type="text"
                                placeholder="e.g. The Smith Family"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Family'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoin}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel} htmlFor="joinCode">Join Code</label>
                            <input
                                id="joinCode"
                                className={styles.formInput}
                                type="text"
                                placeholder="Enter 8-character code"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Joining...' : 'Join Family'}
                        </button>
                    </form>
                )}
            </div>
        </main>
    )
}
