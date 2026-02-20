'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskPriority } from '@/lib/types'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import styles from '../calendar/calendar.module.css'

export default function TasksPage() {
    const { t, language } = useLanguage()
    const [tasks, setTasks] = useState<Task[]>([])
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
    const [loading, setLoading] = useState(true)

    const loadTasks = useCallback(async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data: profile } = await supabase
                .from('users')
                .select('family_id')
                .eq('id', user.id)
                .single()

            if (!profile?.family_id) { setTasks([]); setLoading(false); return }

            let query = supabase
                .from('tasks')
                .select('*')
                .eq('family_id', profile.family_id)
                .order('task_date', { ascending: true })

            if (filter === 'active') query = query.eq('is_completed', false)
            if (filter === 'completed') query = query.eq('is_completed', true)

            const { data } = await query
            if (data) setTasks(data as Task[])
        } catch (err) {
            console.error('loadTasks error:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => { loadTasks() }, [loadTasks])

    const toggleComplete = async (task: Task) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('tasks').update({
            is_completed: !task.is_completed,
            completed_by: !task.is_completed ? user.id : null,
            completed_at: !task.is_completed ? new Date().toISOString() : null,
        }).eq('id', task.id)

        loadTasks()
    }

    const getPriorityColor = (p: TaskPriority) =>
        p === 'red' ? 'var(--priority-red)' : p === 'yellow' ? 'var(--priority-yellow)' : 'var(--priority-green)'

    // Group tasks by date
    const grouped = tasks.reduce((acc, task) => {
        const key = task.task_date
        if (!acc[key]) acc[key] = []
        acc[key].push(task)
        return acc
    }, {} as Record<string, Task[]>)

    return (
        <>
            <div className={styles.calendarHeader}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.headerTitle}>{t('tasks.title')}</h1>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.viewToggle}>
                        {(['all', 'active', 'completed'] as const).map(f => (
                            <button
                                key={f}
                                className={`${styles.viewBtn} ${filter === f ? styles.viewBtnActive : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {t(`tasks.filter.${f}` as 'tasks.filter.all' | 'tasks.filter.active' | 'tasks.filter.completed')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ padding: 'var(--space-xl)' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('tasks.loading')}</p>
                ) : tasks.length === 0 ? (
                    <div className={styles.emptyDay}>
                        <p>{t('tasks.empty')}</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([date, dateTasks]) => (
                        <div key={date} style={{ marginBottom: 'var(--space-xl)' }}>
                            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {new Date(date + 'T00:00:00').toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </h3>
                            <div className={styles.dayViewTasks}>
                                {dateTasks.map(task => (
                                    <div key={task.id} className={styles.taskCard}>
                                        <div className={styles.taskPriority} style={{ backgroundColor: getPriorityColor(task.priority) }} />
                                        <button
                                            className={`${styles.taskCheckbox} ${task.is_completed ? styles.taskChecked : ''}`}
                                            onClick={() => toggleComplete(task)}
                                        >
                                            {task.is_completed && '✓'}
                                        </button>
                                        <div className={styles.taskContent}>
                                            <div className={`${styles.taskTitle} ${task.is_completed ? styles.taskTitleDone : ''}`}>
                                                {task.title}
                                            </div>
                                            <div className={styles.taskMeta}>
                                                {task.task_time && <span>🕐 {task.task_time.slice(0, 5)}</span>}
                                                {task.is_private && <span>🔒</span>}
                                                {task.creator && <span>{task.creator.display_name}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    )
}
