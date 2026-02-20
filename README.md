This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

<br />
<hr />

# 📅 Calendar & Task Application

> [!NOTE]
> **Repository Status**: This project is now hosted on GitHub.
> **Repository URL**: [https://github.com/SilverFlashSF/calendar-task](https://github.com/SilverFlashSF/calendar-task)
> **Condition**: Initial upload completed. Local repository is synchronized with `master` branch.

A modern, family-oriented productivity application built with Next.js and Supabase. Organize your life with shared tasks, real-time updates, and dual-language support (English/Burmese).

## ✨ Features

- **Authentication**: Secure sign-up and login with Supabase Auth.
- **Family Groups**: Join or create family groups to share tasks and events.
- **Calendar**: Interactive monthly, weekly, and daily views to manage your schedule.
- **Tasks**: Create, edit, and prioritize tasks with support for recurring schedules.
- **Real-time Updates**: Changes are instantly reflected across all devices using Supabase Realtime.
- **Dual Language Support**: Full localization support for English (🇺🇸) and Burmese (🇲🇲).
- **Responsive Design**: Optimized for both desktop and mobile web experiences.
- **Dark Mode Compatible**: sleek and modern UI.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Styling**: CSS Modules
- **State Management**: React Hooks & Context API

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase project set up

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SilverFlashSF/calendar-task-web.git
    cd calendar-task-web
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env.local` file in the root directory and add your Supabase credentials:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

```
src/
├── app/                  # App Router pages and layouts
│   ├── (app)/            # Authenticated routes (Calendar, Tasks, Settings)
│   ├── (auth)/           # Authentication routes (Login, Register)
│   └── page.tsx          # Landing page
├── components/           # Reusable UI components
├── lib/                  # Utilities, hooks, and types
│   ├── contexts/         # React Contexts (Language, etc.)
│   ├── i18n/             # Translation files (en.json, my.json)
│   └── supabase/         # Supabase client configuration
└── styles/               # Global styles
```

## 🌍 Localization

The app supports English and Burmese. Translations are managed in `src/lib/i18n/translations/`. To add a new language:
1. Create a new JSON file in the translations directory.
2. Update `LanguageContext.tsx` to include the new language type.
3. Add the language option to the Settings page switcher.

---
*Built with ❤️ for efficient family organization.*
