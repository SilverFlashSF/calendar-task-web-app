'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import styles from '../calendar/calendar.module.css'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadNotifications() }, [])

    const loadNotifications = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (data) setNotifications(data)
        setLoading(false)
    }

    const markAsRead = async (id: string) => {
        const supabase = createClient()
        await supabase.from('notifications').update({ is_read: true }).eq('id', id)
        loadNotifications()
    }

    const markAllRead = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
        loadNotifications()
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'task_created': return '✅'
            case 'task_completed': return '🎉'
            case 'comment': return '💬'
            case 'reminder': return '🔔'
            default: return '📌'
        }
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <>
            <div className={styles.calendarHeader}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.headerTitle}>Notifications {unreadCount > 0 && `(${unreadCount})`}</h1>
                </div>
                {unreadCount > 0 && (
                    <div className={styles.headerRight}>
                        <button className={styles.todayBtn} onClick={markAllRead}>Mark all read</button>
                    </div>
                )}
            </div>

            <div style={{ padding: 'var(--space-xl)' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
                ) : notifications.length === 0 ? (
                    <div className={styles.emptyDay}>
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {notifications.map(n => (
                            <div
                                key={n.id}
                                className={styles.taskCard}
                                style={{ opacity: n.is_read ? 0.6 : 1 }}
                                onClick={() => !n.is_read && markAsRead(n.id)}
                            >
                                <span style={{ fontSize: '20px' }}>{getIcon(n.type)}</span>
                                <div className={styles.taskContent}>
                                    <div className={styles.taskTitle}>{n.title}</div>
                                    {n.body && <div className={styles.taskMeta}><span>{n.body}</span></div>}
                                    <div className={styles.taskMeta}>
                                        <span>{new Date(n.created_at).toLocaleString()}</span>
                                        {!n.is_read && <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>New</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
