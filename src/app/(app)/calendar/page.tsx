'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskPriority, RecurrenceType } from '@/lib/types'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import styles from './calendar.module.css'

type ViewMode = 'month' | 'week' | 'day'

function formatDateStr(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getPriorityColor(p: TaskPriority): string {
    return p === 'red' ? 'var(--priority-red)' : p === 'yellow' ? 'var(--priority-yellow)' : 'var(--priority-green)'
}

export default function CalendarPage() {
    const { t, language } = useLanguage()
    const [view, setView] = useState<ViewMode>('month')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [tasks, setTasks] = useState<Task[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [loading, setLoading] = useState(true)

    // Task form state
    const [title, setTitle] = useState('')
    const [note, setNote] = useState('')
    const [taskDate, setTaskDate] = useState('')
    const [taskTime, setTaskTime] = useState('')
    const [priority, setPriority] = useState<TaskPriority>('green')
    const [isPrivate, setIsPrivate] = useState(false)
    const [recurrence, setRecurrence] = useState<RecurrenceType>('none')
    const [formError, setFormError] = useState('')
    const [saving, setSaving] = useState(false)

    // Generate virtual recurring task instances within a date range
    // Uses date strings (YYYY-MM-DD) for comparisons to avoid timezone issues
    const expandRecurringTasks = (parentTasks: Task[], rangeStart: Date, rangeEnd: Date): Task[] => {
        const virtual: Task[] = []
        const startStr = formatDateStr(rangeStart)
        const endStr = formatDateStr(rangeEnd)

        for (const parent of parentTasks) {
            if (parent.recurrence_type === 'none') continue

            // Parse parent date in local timezone (midnight)
            const [py, pm, pd] = parent.task_date.split('-').map(Number)
            const cursor = new Date(py, pm - 1, pd)
            const recEndStr = parent.recurrence_end_date || endStr

            // Advance cursor by one interval (the parent's own date is already in the DB)
            advanceCursor(cursor, parent.recurrence_type)

            let cursorStr = formatDateStr(cursor)
            while (cursorStr <= endStr && cursorStr <= recEndStr) {
                if (cursorStr >= startStr) {
                    virtual.push({
                        ...parent,
                        id: `${parent.id}_${cursorStr}`,
                        task_date: cursorStr,
                        is_completed: false,
                        completed_by: null,
                        completed_at: null,
                        parent_task_id: parent.id,
                    } as Task)
                }
                advanceCursor(cursor, parent.recurrence_type)
                cursorStr = formatDateStr(cursor)
            }
        }
        return virtual
    }

    const advanceCursor = (cursor: Date, recType: RecurrenceType) => {
        if (recType === 'daily') cursor.setDate(cursor.getDate() + 1)
        else if (recType === 'weekly') cursor.setDate(cursor.getDate() + 7)
        else if (recType === 'monthly') cursor.setMonth(cursor.getMonth() + 1)
    }

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

            // Get date range based on view
            let startDate: Date, endDate: Date

            if (view === 'month') {
                startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
                startDate.setDate(startDate.getDate() - startDate.getDay())
                endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
                endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))
            } else if (view === 'week') {
                startDate = new Date(currentDate)
                startDate.setDate(startDate.getDate() - startDate.getDay())
                endDate = new Date(startDate)
                endDate.setDate(endDate.getDate() + 6)
            } else {
                startDate = new Date(currentDate)
                endDate = new Date(currentDate)
            }

            // Fetch tasks within the visible date range
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('family_id', profile.family_id)
                .gte('task_date', formatDateStr(startDate))
                .lte('task_date', formatDateStr(endDate))
                .order('task_time', { ascending: true, nullsFirst: false })

            if (error) { console.error('Tasks query error:', error); }

            // Also fetch recurring parent tasks that started BEFORE this range
            const { data: recurringParents } = await supabase
                .from('tasks')
                .select('*')
                .eq('family_id', profile.family_id)
                .lt('task_date', formatDateStr(startDate))
                .neq('recurrence_type', 'none')

            const baseTasks = (data || []) as Task[]
            const parents = (recurringParents || []) as Task[]

            // Also expand recurring tasks that start WITHIN the visible range
            const inRangeRecurring = baseTasks.filter(t => t.recurrence_type !== 'none')

            // Combine all recurring parents for expansion
            const allRecurring = [...parents, ...inRangeRecurring]
            const virtualTasks = expandRecurringTasks(allRecurring, startDate, endDate)

            // Merge: base tasks + virtual instances (avoid duplicates by date+parent)
            const existingKeys = new Set(baseTasks.map(t => `${t.parent_task_id || t.id}_${t.task_date}`))
            const uniqueVirtual = virtualTasks.filter(v => !existingKeys.has(`${v.parent_task_id}_${v.task_date}`))

            setTasks([...baseTasks, ...uniqueVirtual])
        } catch (err) {
            console.error('loadTasks error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentDate, view])

    useEffect(() => {
        loadTasks()
    }, [loadTasks])

    // Subscribe to realtime changes
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('tasks-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                loadTasks()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [loadTasks])

    const openCreateModal = (date?: Date) => {
        setEditingTask(null)
        setTitle('')
        setNote('')
        setTaskDate(formatDateStr(date || currentDate))
        setTaskTime('')
        setPriority('green')
        setIsPrivate(false)
        setRecurrence('none')
        setFormError('')
        setShowModal(true)
    }

    const openEditModal = (task: Task) => {
        setEditingTask(task)
        setTitle(task.title)
        setNote(task.note || '')
        setTaskDate(task.task_date)
        setTaskTime(task.task_time || '')
        setPriority(task.priority)
        setIsPrivate(task.is_private)
        setRecurrence(task.recurrence_type)
        setFormError('')
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!title.trim()) {
            setFormError(t('calendar.error.titleRequired'))
            return
        }
        if (!taskDate) {
            setFormError(t('calendar.error.dateRequired'))
            return
        }

        setSaving(true)
        setFormError('')
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('users')
            .select('family_id')
            .eq('id', user.id)
            .single()

        if (!profile?.family_id) return

        const taskData = {
            title: title.trim(),
            note: note.trim() || null,
            task_date: taskDate,
            task_time: taskTime || null,
            priority,
            is_private: isPrivate,
            recurrence_type: recurrence,
            family_id: profile.family_id,
            created_by: user.id,
        }

        if (editingTask) {
            const { error } = await supabase
                .from('tasks')
                .update(taskData)
                .eq('id', editingTask.id)

            if (error) { setFormError(error.message); setSaving(false); return }
        } else {
            const { error } = await supabase
                .from('tasks')
                .insert(taskData)

            if (error) { setFormError(error.message); setSaving(false); return }
        }

        setShowModal(false)
        setSaving(false)
        loadTasks()
    }

    const handleDelete = async () => {
        if (!editingTask) return
        if (!confirm(t('calendar.confirm.delete'))) return

        // Determine the actual DB ID to delete
        // If it's a virtual recurring task (has parent_task_id or ID contains underscore), delete the parent (series)
        // UUIDs use hyphens, so underscore check is safe for virtual IDs like "uuid_date"
        const isVirtual = editingTask.id.includes('_') || !!editingTask.parent_task_id
        const deleteId = editingTask.parent_task_id || (isVirtual ? editingTask.id.split('_')[0] : editingTask.id)

        // Optimistic update: Remove immediately from UI
        setTasks(prev => prev.filter(t => {
            // Remove if it's the exact task (normal case)
            if (t.id === deleteId) return false
            // Remove if it's a child/virtual of the deleted task
            if (t.parent_task_id === deleteId) return false
            // Remove if ID starts with the deleted ID (safety for virtuals)
            if (t.id.startsWith(deleteId + '_')) return false
            return true
        }))

        setShowModal(false)

        const supabase = createClient()
        const { error } = await supabase.from('tasks').delete().eq('id', deleteId)

        if (error) {
            console.error('Delete error:', error)
            // Revert on error (optional, or just reload)
            loadTasks()
        } else {
            // Success - loadTasks will eventually consistency check, but optimistic update holds
            loadTasks()
        }
    }

    const toggleComplete = async (task: Task) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
            .from('tasks')
            .update({
                is_completed: !task.is_completed,
                completed_by: !task.is_completed ? user.id : null,
                completed_at: !task.is_completed ? new Date().toISOString() : null,
            })
            .eq('id', task.id)

        loadTasks()
    }

    const navigate = (dir: number) => {
        const d = new Date(currentDate)
        if (view === 'month') d.setMonth(d.getMonth() + dir)
        else if (view === 'week') d.setDate(d.getDate() + (dir * 7))
        else d.setDate(d.getDate() + dir)
        setCurrentDate(d)
    }

    const goToday = () => setCurrentDate(new Date())

    const getHeaderTitle = () => {
        const locale = language === 'my' ? 'my-MM' : 'en-US'
        if (view === 'month') {
            return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        }
        if (view === 'week') {
            const s = new Date(currentDate)
            s.setDate(s.getDate() - s.getDay())
            const e = new Date(s)
            e.setDate(e.getDate() + 6)
            const sStr = s.toLocaleDateString(locale, { month: 'long', day: 'numeric' })
            const eStr = e.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
            return `${sStr} – ${eStr}`
        }
        return currentDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }

    // Monthly view helpers
    const getMonthDays = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const days: Date[] = []

        // Previous month fill
        for (let i = firstDay.getDay() - 1; i >= 0; i--) {
            const d = new Date(year, month, -i)
            days.push(d)
        }
        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i))
        }
        // Next month fill
        const remaining = 7 - (days.length % 7)
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                days.push(new Date(year, month + 1, i))
            }
        }
        return days
    }

    const getWeekDays = () => {
        const s = new Date(currentDate)
        s.setDate(s.getDate() - s.getDay())
        const days: Date[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(s)
            d.setDate(d.getDate() + i)
            days.push(d)
        }
        return days
    }

    const getTasksForDate = (date: Date) => {
        return tasks.filter(t => t.task_date === formatDateStr(date))
    }

    const today = formatDateStr(new Date())

    const getDayName = (dayIndex: number) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
        return t(`calendar.weekday.${days[dayIndex]}` as 'calendar.weekday.sun' | 'calendar.weekday.mon' | 'calendar.weekday.tue' | 'calendar.weekday.wed' | 'calendar.weekday.thu' | 'calendar.weekday.fri' | 'calendar.weekday.sat')
    }

    const renderTaskCard = (task: Task) => (
        <div key={task.id} className={styles.taskCard} onClick={() => openEditModal(task)}>
            <div className={styles.taskPriority} style={{ backgroundColor: getPriorityColor(task.priority) }} />
            <button
                className={`${styles.taskCheckbox} ${task.is_completed ? styles.taskChecked : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleComplete(task) }}
            >
                {task.is_completed && '✓'}
            </button>
            <div className={styles.taskContent}>
                <div className={`${styles.taskTitle} ${task.is_completed ? styles.taskTitleDone : ''}`}>
                    {task.title}
                </div>
                <div className={styles.taskMeta}>
                    {task.task_time && <span className={styles.taskTime}>🕐 {task.task_time.slice(0, 5)}</span>}
                    {task.is_private && <span className={styles.taskPrivate}>🔒</span>}
                    {task.creator && <span className={styles.taskCreator}>{task.creator.display_name}</span>}
                </div>
            </div>
        </div>
    )

    if (loading) {
        return <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>{t('tasks.loading')}</div>
    }

    return (
        <>
            {/* Header */}
            <div className={styles.calendarHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.navBtns}>
                        <button className={styles.navBtn} onClick={() => navigate(-1)}>◀</button>
                        <button className={styles.navBtn} onClick={() => navigate(1)}>▶</button>
                    </div>
                    <h1 className={styles.headerTitle}>{getHeaderTitle()}</h1>
                    <button className={styles.todayBtn} onClick={goToday}>{t('calendar.header.today')}</button>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.viewToggle}>
                        {(['month', 'week', 'day'] as ViewMode[]).map(v => (
                            <button
                                key={v}
                                className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
                                onClick={() => setView(v)}
                            >
                                {t(`calendar.view.${v}`)}
                            </button>
                        ))}
                    </div>
                    <button className={styles.addTaskBtn} onClick={() => openCreateModal()}>
                        {t('calendar.action.newTask')}
                    </button>
                </div>
            </div>

            {/* Monthly View */}
            {view === 'month' && (
                <div className={styles.monthGrid}>
                    <div className={styles.weekDaysHeader}>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className={styles.weekDay}>{getDayName(i)}</div>
                        ))}
                    </div>
                    <div className={styles.daysGrid}>
                        {getMonthDays().map((day, i) => {
                            const dateStr = formatDateStr(day)
                            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                            const isToday = dateStr === today
                            const dayTasks = getTasksForDate(day)
                            return (
                                <div
                                    key={i}
                                    className={`${styles.dayCell} ${!isCurrentMonth ? styles.dayCellOther : ''} ${isToday ? styles.dayCellToday : ''}`}
                                    onClick={() => openCreateModal(day)}
                                >
                                    <div className={`${styles.dayNumber} ${isToday ? styles.dayNumberToday : ''}`}>
                                        {day.getDate()}
                                    </div>
                                    <div className={styles.dayTasks}>
                                        {dayTasks.slice(0, 3).map(t => (
                                            <div
                                                key={t.id}
                                                className={styles.dayTaskItem}
                                                onClick={(e) => { e.stopPropagation(); openEditModal(t) }}
                                            >
                                                <span className={styles.dayTaskDot} style={{ backgroundColor: getPriorityColor(t.priority) }} />
                                                <span className={`${styles.dayTaskTitle} ${t.is_completed ? styles.dayTaskCompleted : ''}`}>
                                                    {t.title}
                                                </span>
                                            </div>
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <div className={styles.moreCount}>+{dayTasks.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Weekly View */}
            {view === 'week' && (
                <div className={styles.weekGrid}>
                    <div className={styles.weekRow}>
                        {getWeekDays().map((day, i) => {
                            const dateStr = formatDateStr(day)
                            const isToday = dateStr === today
                            const dayTasks = getTasksForDate(day)
                            return (
                                <div key={i} className={styles.weekDayCol}>
                                    <div className={styles.weekDayHeader}>
                                        <div className={styles.weekDayName}>{getDayName(i)}</div>
                                        <div className={`${styles.weekDayNum} ${isToday ? styles.weekDayNumToday : ''}`}>
                                            {day.getDate()}
                                        </div>
                                    </div>
                                    <div className={styles.weekTaskList}>
                                        {dayTasks.map(renderTaskCard)}
                                        {dayTasks.length === 0 && (
                                            <div
                                                style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
                                                onClick={() => openCreateModal(day)}
                                            >
                                                {t('calendar.action.add')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Daily View */}
            {view === 'day' && (
                <div className={styles.dayView}>
                    <div className={styles.dayViewDate}>
                        {currentDate.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <div className={styles.dayViewTasks}>
                        {getTasksForDate(currentDate).map(renderTaskCard)}
                        {getTasksForDate(currentDate).length === 0 && (
                            <div className={styles.emptyDay}>
                                <p>{t('calendar.empty.day')}</p>
                                <button className={styles.addTaskBtn} onClick={() => openCreateModal()} style={{ marginTop: '16px' }}>
                                    {t('calendar.action.addTask')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>{editingTask ? t('calendar.modal.edit') : t('calendar.modal.new')}</h2>
                            <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            {formError && <div className={styles.errorMsg}>{formError}</div>}

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>{t('calendar.field.title')}</label>
                                <input
                                    className={styles.formInput}
                                    type="text"
                                    placeholder={t('calendar.placeholder.title')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>{t('calendar.field.note')}</label>
                                <textarea
                                    className={`${styles.formInput} ${styles.formTextarea}`}
                                    placeholder={t('calendar.placeholder.note')}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>{t('calendar.field.date')}</label>
                                    <input
                                        className={styles.formInput}
                                        type="date"
                                        value={taskDate}
                                        onChange={(e) => setTaskDate(e.target.value)}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>{t('calendar.field.time')}</label>
                                    <input
                                        className={styles.formInput}
                                        type="time"
                                        value={taskTime}
                                        onChange={(e) => setTaskTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>{t('calendar.field.priority')}</label>
                                <div className={styles.priorityOptions}>
                                    <button
                                        type="button"
                                        className={`${styles.priorityOption} ${styles.priorityRed} ${priority === 'red' ? styles.priorityRedActive : ''}`}
                                        onClick={() => setPriority('red')}
                                    >
                                        🔴 {t('priority.high')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.priorityOption} ${styles.priorityYellow} ${priority === 'yellow' ? styles.priorityYellowActive : ''}`}
                                        onClick={() => setPriority('yellow')}
                                    >
                                        🟡 {t('priority.medium')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.priorityOption} ${styles.priorityGreen} ${priority === 'green' ? styles.priorityGreenActive : ''}`}
                                        onClick={() => setPriority('green')}
                                    >
                                        🟢 {t('priority.low')}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>{t('calendar.field.recurrence')}</label>
                                    <select
                                        className={styles.formSelect}
                                        value={recurrence}
                                        onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                                    >
                                        <option value="none">{t('calendar.recurrence.none')}</option>
                                        <option value="daily">{t('calendar.recurrence.daily')}</option>
                                        <option value="weekly">{t('calendar.recurrence.weekly')}</option>
                                        <option value="monthly">{t('calendar.recurrence.monthly')}</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isPrivate}
                                            onChange={(e) => setIsPrivate(e.target.checked)}
                                        />
                                        🔒 {t('calendar.field.private')}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            {editingTask && (
                                <button className={styles.deleteBtn} onClick={handleDelete}>{t('calendar.action.delete')}</button>
                            )}
                            <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>{t('calendar.action.cancel')}</button>
                            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                                {saving ? t('calendar.action.saving') : editingTask ? t('calendar.action.update') : t('calendar.action.create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
