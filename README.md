# React Marketplace Template

A modern, fully-featured e-commerce marketplace template built with React, Vite, and Tailwind CSS. This template is designed to provide a solid foundation for any online store or multi-vendor marketplace, complete with a clean UI, dark mode support, and pre-built components for admin, seller, and buyer flows.

## 🚀 Features

- **Modern Tech Stack:** React 19, Vite, Tailwind CSS 3.4
- **Responsive Design:** Mobile-first approach, looks great on all devices.
- **Dark Mode Support:** Built-in light/dark theme toggling.
- **Pre-built Dashboards:**
  - Admin Dashboard (Manage users, products, orders)
  - Seller/Rider Dashboard (Manage deliveries)
  - User Profile (Order history, settings)
- **Ready for Backend:** Configured with Supabase (can be easily swapped to Firebase or custom REST API).
- **Fast Performance:** Optimized with Vite for lightning-fast HMR and small build sizes.

## 🛠 Prerequisites

Make sure you have installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm, yarn, or pnpm

## 📦 Installation

1. Clone or download the repository, then navigate into the project directory:
   ```bash
   cd react-marketplace-template
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## ⚙️ Environment Variables

1. Rename `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## 🗄️ Database Setup (Supabase)

If you are using Supabase as your backend, you can find the complete SQL schema in the `database/` folder.
1. Go to your Supabase project dashboard -> **SQL Editor**.
2. Open the file `database/01-schema.sql` and copy its entire content.
3. Paste it into the SQL Editor and click **Run**. This will instantly create all necessary tables, RLS policies, and Storage Buckets for you!

## 🏃‍♂️ Development

To start the development server:
```bash
npm run dev
```

## 🏗️ Production Build

To build the app for production:
```bash
npm run build
```
This will generate a `dist` folder that you can deploy to Vercel, Netlify, or any static hosting service.

## 📄 License

This template is for personal or commercial use. Please do not resell the raw template codebase.
