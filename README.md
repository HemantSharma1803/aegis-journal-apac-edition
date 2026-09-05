Aegis Journal - Secure Personal Gemini Journal | APAC Edition
Zero-knowledge encrypted journaling companion powered by Gemini AI.

🔴 Live Demo
Working Prototype Video (2:30 min HD): https://youtu.be/GoHMML2_tmE **LinkedIn Post:https://lnkd.in/p/d-YATird

Note: Live deployment requires Firebase & Gemini secrets. Please refer to the demo video for full working prototype. Code runs locally.

💡 Problem & Solution
Journaling apps store private thoughts in plain text. Aegis Journal solves this with client-side PII scrubbing + PBKDF2 + AES-GCM encryption. Raw thoughts never leave device unencrypted. Gemini analyzes only decrypted secure content server-side.

✨ Features
🔒 Firebase Auth for secure login/signup
📝 User-isolated Firestore storage at users/{userId}/entries/{entryId} with fields encryptedData, iv, moodScore, createdAt
🤖 Multi-turn Gemini API for mood analysis, intelligent insights & auto-tags
🛡️ Client-side security - AES-GCM encryption before Firestore save
☁️ Cloud Run ready containerized deployment
📱 React + Vite + Tailwind CSS
🛠️ Tech Stack
Frontend: React, Vite, Tailwind CSS
Backend: Node.js Express (server.ts)
Auth & DB: Firebase Auth, Firestore, firestore.rules
AI: Google Gemini API
Deployment: Cloud Run, Firebase Hosting
🚀 Run Locally
Prerequisites: Node.js

Clone: git clone https://github.com/HemantSharma1803/aegis-journal-apac-edition
Install: npm install
Create .env.local file:
Run: npm run dev
Backend: node server.ts or bun run server.ts
📂 Project Structure
server.ts - Express server for Gemini API calls
firestore.rules - User-isolated security rules
firebase-blueprint.json - Firebase config
🏆 Hackathon
Gen AI Academy APAC - Ideathon Challenge - #AccelerateAIwithCloudRun

Built by Hemant Sharma - JECRC Jaipur