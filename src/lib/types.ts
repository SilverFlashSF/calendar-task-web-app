// TypeScript types matching the Supabase schema

export type TaskPriority = 'red' | 'yellow' | 'green'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'
export type NotificationType = 'task_created' | 'task_completed' | 'comment' | 'reminder'

export interface User {
    id: string
    email: string
    display_name: string
    avatar_url: string | null
    family_id: string | null
    created_at: string
}

export interface Family {
    id: string
    name: string
    join_code: string
    created_by: string
    created_at: string
}

export interface FamilyMember {
    id: string
    family_id: string
    user_id: string
    joined_at: string
    user?: User
}

export interface Task {
    id: string
    family_id: string
    created_by: string
    title: string
    note: string | null
    task_date: string
    task_time: string | null
    priority: TaskPriority
    is_private: boolean
    is_completed: boolean
    completed_by: string | null
    completed_at: string | null
    recurrence_type: RecurrenceType
    recurrence_end_date: string | null
    parent_task_id: string | null
    reminder_sent: boolean
    created_at: string
    updated_at: string
    creator?: User
    completer?: User
    comments?: Comment[]
}

export interface Comment {
    id: string
    task_id: string
    user_id: string
    parent_comment_id: string | null
    content: string
    created_at: string
    updated_at: string
    author?: User
    replies?: Comment[]
}

export interface Notification {
    id: string
    user_id: string
    type: NotificationType
    title: string
    body: string
    task_id: string | null
    is_read: boolean
    created_at: string
}
