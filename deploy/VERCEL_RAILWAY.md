# رفع ProjectFlow على Vercel + Railway

| الجزء | وين | ليش |
|---|---|---|
| الموقع (Next.js) | **Vercel** (مجاني) | أسرع وأسهل استضافة لـ Next.js |
| السيرفر (API) + محرك التذكيرات + قاعدة البيانات + الملفات | **Railway** (~5$ بالشهر حسب الاستخدام) | Vercel ما بيشغّل برامج بتضل شغّالة 24 ساعة، وما بيحفظ ملفات، وحد الطلب عنده 4.5MB |

```
المتصفح ──► Vercel (الموقع)  ──/api──►  Railway: api ──► Railway: Postgres
   │                                          ▲     │
   └──── رفع/تنزيل الملفات مباشرة ─────────────┘     └─ Volume (الملفات)
                                     Railway: worker (التذكيرات: in-app / email / WhatsApp)
```

> **مهم**: خطة Vercel المجانية (Hobby) للاستخدام الشخصي غير التجاري حسب شروطهم. لاستخدام شركة رسمي استخدم **Pro**.

---

## 1) الحسابات (أنت بتعملها)

1. https://vercel.com/signup — الأسهل **Continue with GitHub**.
2. https://railway.com — **Login with GitHub**، وبعدها فعّل خطة **Hobby** (Railway ← Account ← Plans). بتطلب بطاقة.

## 2) Railway — السيرفر وقاعدة البيانات

**New Project ← Deploy from GitHub repo ← `PM-Solution`**. هذا بيعمل أول service، سمّيه **`api`**.
ملف [`railway.json`](../railway.json) بالـ repo بيحدد كل إشي (Dockerfile، أمر التشغيل، health check)، فما في داعي تعدّل Build/Deploy settings.

ضيف بنفس المشروع:
- **+ Create ← Database ← PostgreSQL** (اسمها بيكون `Postgres`)
- **+ Create ← GitHub Repo ← نفس الـ repo** وسمّيه **`worker`**

### متغيرات `api` (Variables ← Raw Editor):
```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<openssl rand -base64 48>
ENCRYPTION_KEY=<openssl rand -base64 32>
WEB_ORIGIN=https://<اسم-مشروعك>.vercel.app
ALLOW_REGISTRATION=false
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<كلمة سر قوية>
ADMIN_NAME=Administrator
TRUST_PROXY=2
RAILWAY_RUN_UID=0
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=ProjectFlow <no-reply@example.com>
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_TEMPLATE_NAME=
WHATSAPP_TEMPLATE_LANG=ar
```
- `RAILWAY_RUN_UID=0` ضروري: الـ Volume على Railway ملك root، وبدونه رفع الملفات بيفشل.
- `TRUST_PROXY=2`: الطلبات بتمر بـ Vercel وبعدين Railway، فهيك حماية "محاولات الدخول الكثيرة" بتشوف IP المستخدم الحقيقي.

### Volume للملفات
على `api`: **Settings ← Volumes ← + New Volume** ← Mount path: **`/repo/apps/api/storage`**

### دومين عام للـ API
على `api`: **Settings ← Networking ← Generate Domain** ← بيعطيك مثل `https://api-production-xxxx.up.railway.app`. احفظه.

### متغيرات `worker`:
```
PF_ROLE=worker
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENCRYPTION_KEY=${{api.ENCRYPTION_KEY}}
SMTP_HOST=${{api.SMTP_HOST}}
SMTP_PORT=${{api.SMTP_PORT}}
SMTP_USER=${{api.SMTP_USER}}
SMTP_PASS=${{api.SMTP_PASS}}
SMTP_FROM=${{api.SMTP_FROM}}
WHATSAPP_PHONE_NUMBER_ID=${{api.WHATSAPP_PHONE_NUMBER_ID}}
WHATSAPP_ACCESS_TOKEN=${{api.WHATSAPP_ACCESS_TOKEN}}
WHATSAPP_TEMPLATE_NAME=${{api.WHATSAPP_TEMPLATE_NAME}}
WHATSAPP_TEMPLATE_LANG=${{api.WHATSAPP_TEMPLATE_LANG}}
```
(`PF_ROLE=worker` هو اللي بيخلي نفس الكود يشتغل كمحرك تذكيرات بدل API.)

**Deploy**. للتأكد افتح: `https://api-production-xxxx.up.railway.app/health` ← لازم `"status":"ok"` و `"worker":{"healthy":true}`.

## 3) Vercel — الموقع

**Add New ← Project ← Import `PM-Solution`**:
- **Root Directory**: `apps/web` (مهم)
- Framework: Next.js (لحاله). أوامر install/build مأخوذة من [`apps/web/vercel.json`](../apps/web/vercel.json).
- **Environment Variables**:
  ```
  NEXT_PUBLIC_API_BASE_URL=/api
  API_INTERNAL_URL=https://api-production-xxxx.up.railway.app
  NEXT_PUBLIC_FILES_API_BASE_URL=https://api-production-xxxx.up.railway.app/api
  ```
- **Deploy**.

بعد ما يخلص، Vercel بيعطيك الرابط (مثل `https://projectflow.vercel.app`). **ارجع لـ Railway** وتأكد إنه `WEB_ORIGIN` على `api` نفس هذا الرابط بالضبط (بدون `/` بالآخر) — وإلا رفع الملفات بيفشل.

## 4) أول دخول

افتح رابط Vercel ← سجّل دخول بـ `ADMIN_EMAIL` / `ADMIN_PASSWORD` ← **Admin ← Users** لإضافة المستخدمين، و **Admin ← Notifications** لتجربة الإيميل والواتساب (إعدادهم مشروح بـ [GODADDY.md](GODADDY.md) الأقسام 7 و 8 — نفس المتغيرات، بس بتحطها بـ Railway Variables بدل ملف `.env`).

## دومين خاص (اختياري)
- **Vercel ← Project ← Settings ← Domains ← Add** ← `projectflow.yourcompany.com` ← حط سجل DNS اللي بيطلبه (CNAME) عند GoDaddy.
- غيّر `WEB_ORIGIN` على Railway للدومين الجديد.

## التحديثات
كل `git push` على `main` ← Vercel و Railway بيعملوا deploy لحالهم، والـ migrations بتنطبق تلقائياً.

## النسخ الاحتياطي
Railway ← Postgres ← **Backups** (حسب الخطة). أو يدوياً من جهازك:
```
pg_dump "<DATABASE_PUBLIC_URL من Railway>" > projectflow-backup.sql
```
