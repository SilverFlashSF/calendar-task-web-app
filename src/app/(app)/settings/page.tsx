'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User, Family } from '@/lib/types'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import headerStyles from '../calendar/calendar.module.css'
import styles from './settings.module.css'

const SAMPLE_AVATARS = [
    { name: 'Luffy', src: '/avatars/luffy.png' },
    { name: 'Zoro', src: '/avatars/zoro.svg' },
    { name: 'Nami', src: '/avatars/nami.svg' },
    { name: 'Sanji', src: '/avatars/sanji.svg' },
    { name: 'Chopper', src: '/avatars/chopper.svg' },
    { name: 'Robin', src: '/avatars/robin.svg' },
]

export default function SettingsPage() {
    const { t, language, setLanguage } = useLanguage()
    const [user, setUser] = useState<User | null>(null)
    const [family, setFamily] = useState<Family | null>(null)
    const [displayName, setDisplayName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [members, setMembers] = useState<User[]>([])
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadData = async () => {
        try {
            const supabase = createClient()
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) { setLoading(false); return }

            const authDisplayName = authUser.user_metadata?.display_name
                || authUser.email?.split('@')[0]
                || 'User'
            const authEmail = authUser.email || ''

            const { data: initialProfile, error: profileError } = await supabase.from('users').select('*').eq('id', authUser.id).single()
            let profile = initialProfile

            if (profileError && profileError.code === 'PGRST116') {
                const { data: newProfile } = await supabase
                    .from('users')
                    .insert({ id: authUser.id, email: authEmail, display_name: authDisplayName })
                    .select()
                    .single()
                if (newProfile) profile = newProfile
            } else if (profile && (!profile.email || !profile.display_name)) {
                const updates: Record<string, string> = {}
                if (!profile.email) updates.email = authEmail
                if (!profile.display_name) updates.display_name = authDisplayName
                const { data: updatedProfile } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', authUser.id)
                    .select()
                    .single()
                if (updatedProfile) profile = updatedProfile
            }

            if (profile) {
                setUser(profile)
                setDisplayName(profile.display_name || authDisplayName)
                setAvatarUrl(profile.avatar_url)
                if (profile.family_id) {
                    const { data: fam } = await supabase.from('families').select('*').eq('id', profile.family_id).single()
                    if (fam) setFamily(fam)

                    const { data: familyMembers } = await supabase
                        .from('users')
                        .select('*')
                        .eq('family_id', profile.family_id)
                        .order('created_at', { ascending: true })

                    if (familyMembers) setMembers(familyMembers)
                }
            }
        } catch (err) {
            console.error('loadData error:', err)
        } finally {
            setLoading(false)
        }
    }

    const showMessage = (msg: string) => {
        setMessage(msg)
        setTimeout(() => setMessage(''), 3000)
    }

    const updateProfile = async () => {
        if (!user || !displayName.trim()) return
        setSaving(true)
        const supabase = createClient()
        await supabase.from('users').update({ display_name: displayName.trim() }).eq('id', user.id)
        showMessage('Profile updated!')
        setSaving(false)
    }

    const selectSampleAvatar = async (src: string) => {
        if (!user) return
        setSaving(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('users')
            .update({ avatar_url: src })
            .eq('id', user.id)
        if (!error) {
            setAvatarUrl(src)
            setUser({ ...user, avatar_url: src })
            showMessage('Avatar updated!')
        } else {
            showMessage('Failed to update avatar')
        }
        setSaving(false)
    }

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !user) return

        // Validate file
        if (!file.type.startsWith('image/')) {
            showMessage('Please select an image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            showMessage('Image must be under 5MB')
            return
        }

        setUploading(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}/avatar.${fileExt}`

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                showMessage('Upload failed — have you set up the avatars bucket in Supabase?')
                setUploading(false)
                return
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Add cache-buster to force refresh
            const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`

            // Update user profile
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: urlWithCacheBust })
                .eq('id', user.id)

            if (!updateError) {
                setAvatarUrl(urlWithCacheBust)
                setUser({ ...user, avatar_url: urlWithCacheBust })
                showMessage('Avatar uploaded!')
            } else {
                showMessage('Failed to save avatar URL')
            }
        } catch (err) {
            console.error('Upload error:', err)
            showMessage('Upload failed')
        } finally {
            setUploading(false)
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeAvatar = async () => {
        if (!user) return
        setSaving(true)
        const supabase = createClient()
        await supabase.from('users').update({ avatar_url: null }).eq('id', user.id)
        setAvatarUrl(null)
        setUser({ ...user, avatar_url: null })
        showMessage('Avatar removed')
        setSaving(false)
    }

    const removeMember = async (memberId: string) => {
        if (!user || !family) return
        if (!confirm(t('settings.family.members.removeConfirm'))) return

        setSaving(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('family_members')
            .delete()
            .eq('user_id', memberId)
            .eq('family_id', family.id)

        if (!error) {
            setMembers(members.filter(m => m.id !== memberId))
            showMessage(t('settings.family.members.removedSuccess'))
        } else {
            showMessage(error.message || 'Failed to remove member')
        }
        setSaving(false)
    }

    const leaveFamily = async () => {
        if (!user || !family) return
        if (!confirm(t('settings.leaveFamily.confirm'))) return

        const supabase = createClient()
        await supabase.from('family_members').delete().eq('user_id', user.id).eq('family_id', family.id)
        await supabase.from('users').update({ family_id: null }).eq('id', user.id)
        router.push('/family')
        router.refresh()
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            </div>
        )
    }

    return (
        <>
            <div className={headerStyles.calendarHeader}>
                <div className={headerStyles.headerLeft}>
                    <h1 className={headerStyles.headerTitle}>{t('settings.title')}</h1>
                </div>
            </div>

            <div className={styles.settingsContainer}>
                {/* Profile Card */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('settings.profile')}</h2>

                    {message && <div className={styles.successMsg}>{message}</div>}

                    {/* Language Switcher */}
                    <div className={`${styles.formGroup} ${styles.languageSwitcher}`}>
                        <label className={styles.formLabel}>{t('settings.language')}</label>
                        <select
                            className={styles.formInput}
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as 'en' | 'my')}
                            aria-label={t('settings.language.select')}
                        >
                            <option value="en">🇺🇸 English</option>
                            <option value="my">🇲🇲 ဗမာ (Burmese)</option>
                        </select>
                    </div>

                    <hr className={styles.divider} />

                    {/* Avatar Section */}
                    <div className={styles.avatarSection}>
                        <div className={styles.avatarPreview}>
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt="Profile avatar"
                                    className={styles.avatarPreviewImg}
                                />
                            ) : (
                                user?.display_name?.charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <span className={styles.avatarLabel}>{t('settings.avatar.label')}</span>
                    </div>

                    {/* Sample Avatars */}
                    <p className={styles.sampleAvatarsTitle}>{t('settings.avatar.sample.title')}</p>
                    <div className={styles.sampleGrid}>
                        {SAMPLE_AVATARS.map((avatar) => (
                            <button
                                key={avatar.name}
                                className={`${styles.sampleItem} ${avatarUrl === avatar.src ? styles.sampleItemSelected : ''}`}
                                onClick={() => selectSampleAvatar(avatar.src)}
                                disabled={saving}
                                type="button"
                            >
                                <img
                                    src={avatar.src}
                                    alt={avatar.name}
                                    className={styles.sampleImg}
                                />
                                <span className={styles.sampleName}>{avatar.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Upload Custom */}
                    <div className={styles.uploadSection}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={uploadAvatar}
                            style={{ display: 'none' }}
                            id="avatar-upload"
                        />
                        <button
                            className={styles.uploadBtn}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            type="button"
                        >
                            {uploading ? t('settings.avatar.uploading') : t('settings.avatar.upload.button')}
                        </button>
                        {avatarUrl && (
                            <button
                                className={styles.removeBtn}
                                onClick={removeAvatar}
                                disabled={saving}
                                type="button"
                            >
                                {t('settings.avatar.remove')}
                            </button>
                        )}
                    </div>

                    <hr className={styles.divider} />

                    {/* Display Name */}
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="settings-email">{t('settings.email.label')}</label>
                        <input
                            id="settings-email"
                            className={styles.formInput}
                            type="email"
                            value={user?.email || ''}
                            disabled
                            style={{ opacity: 0.6 }}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="settings-name">{t('settings.displayName.label')}</label>
                        <input
                            id="settings-name"
                            className={styles.formInput}
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>

                    <button
                        className={styles.saveBtn}
                        onClick={updateProfile}
                        disabled={saving}
                        type="button"
                    >
                        {saving ? t('settings.saving') : t('settings.updateProfile')}
                    </button>
                </div>

                {/* Family Card */}
                {family && (
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>{t('settings.family')}</h2>

                        <div className={styles.familyHeader}>
                            <div>
                                <div className={styles.familyName}>{family.name}</div>
                                <div className={styles.familyCode}>
                                    {t('settings.family.joinCode')} <code className={styles.familyCodeValue}>{family.join_code}</code>
                                </div>
                            </div>
                        </div>

                        <p className={styles.familyHint}>
                            {t('settings.family.hint')}
                        </p>

                        <hr className={styles.divider} />

                        <div className={styles.membersSection}>
                            <h3 className={styles.membersTitle}>{t('settings.family.members.title')} ({members?.length || 0})</h3>
                            <div className={styles.membersList}>
                                {members?.map((member) => (
                                    <div key={member.id} className={styles.memberItem}>
                                        <div className={styles.memberInfo}>
                                            <div className={styles.memberAvatar}>
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.display_name} className={styles.memberAvatarImg} />
                                                ) : (
                                                    member.display_name?.charAt(0).toUpperCase() || '?'
                                                )}
                                            </div>
                                            <div className={styles.memberDetails}>
                                                <div className={styles.memberName}>
                                                    {member.display_name}
                                                    {member.id === family.created_by && (
                                                        <span className={styles.ownerBadge}>{t('settings.family.members.owner')}</span>
                                                    )}
                                                </div>
                                                <div className={styles.memberEmail}>{member.email}</div>
                                            </div>
                                        </div>

                                        {user?.id === family.created_by && member.id !== user.id && (
                                            <button
                                                className={styles.removeMemberBtn}
                                                onClick={() => removeMember(member.id)}
                                                disabled={saving}
                                                title={t('settings.family.members.remove')}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <hr className={styles.divider} />

                        <button className={styles.leaveBtn} onClick={leaveFamily} type="button">
                            {t('settings.leaveFamily')}
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
