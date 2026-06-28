<div align="center">

# 🍽️ BESTA - QR-Based Restaurant Management & Ordering System

A comprehensive, production-grade hybrid web and mobile ecosystem designed for modern restaurants. Features real-time order tracking, digital menu management, kitchen display coordination, and Capacitor-wrapped native Android push notifications.

[![HTML5](https://img.shields.io/badge/Frontend-HTML5%20%2F%20CSS3%20%2F%20JS-E34F26?style=flat-square&logo=html5)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor%20Native-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com)
[![Node.js](https://img.shields.io/badge/Backend-Node%20%2F%20Express-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-003B57?style=flat-square&logo=sqlite)](https://sqlite.org)
[![Socket.IO](https://img.shields.io/badge/Real--time-Socket.IO-010101?style=flat-square&logo=socketdotio)](https://socket.io)

</div>

---

## 🌟 Key Features

- **QR-Based Menu & Ordering**: Generate unique dynamic QR codes for each dining table. Customers scan the QR code to open the digital menu and place orders instantly.
- **Kitchen Display System (KDS)**: Real-time orders feed directly into a responsive kitchen dashboard, allowing kitchen staff to update preparation statuses.
- **Admin & Staff Portal**: Role-based access for admins and waiters to manage table statuses, menus, pricing, and live waiter call notifications.
- **Capacitor Android Client**: Fully compiled native Android wrapper supporting FCM (Firebase Cloud Messaging) push notifications for real-time order status changes.
- **Dual-Database Support**: Configured to run seamlessly with SQLite locally for development and PostgreSQL in production (Render).

---

## 🏗️ System Architecture

```
restaurant-management-software/
├── android/           # Capacitor-wrapped native Android build files
├── public/            # Static Web app files (customer menu, KDS, Admin)
│   ├── css/
│   ├── js/
│   └── index.html
│
├── server/            # Node.js + Express backend
│   ├── database/      # SQLite migrations and PG client setups
│   ├── index.js       # App entry & Socket.IO server initialization
│   └── routes/        # Order and administration API endpoints
│
├── capacitor.config.json # Capacitor project config
├── package.json       # Dependencies and runner scripts
└── render.yaml        # Infrastructure blueprint for automated Render deploy
```

---

## 🚀 Setup & Execution

### Prerequisites
- Node.js (v18+)
- Android Studio (for compiling/running the native client)

### 1. Backend Server Setup
Install the root dependencies:
```bash
npm install
```

Configure environment variables in a `.env` file (if deploying with Postgres):
```env
DATABASE_URL=postgresql://username:password@host:port/database
PORT=3000
```

### 2. Run in Development Mode
To boot the express server and live Socket.IO gateway using SQLite:
```bash
npm run dev
```
- Open `http://localhost:3000` to view the landing dashboard.

### 3. Native Android Build
To synchronize web changes and compile/launch the Android app:
```bash
npx cap sync
npx cap open android
```

---

## ☁️ Deployment

This project contains a `render.yaml` specification to provision a unified Web Service with a connected PostgreSQL instance on Render. The setup scripts automatically execute schema migrations from local sqlite configurations to postgres database instances.
