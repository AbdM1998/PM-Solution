# رفع ProjectFlow على GoDaddy — دليل خطوة بخطوة

النتيجة: موقع على دومينك (مثلاً `https://projectflow.yourcompany.com`) يفتح من أي جهاز أو موبايل، عليه
حساب مدير (Admin) واحد بتعمله أنت، وهو اللي بيضيف باقي المستخدمين من صفحة Admin.

> نسخة الديسكتوب (البرنامج اللي على جهازك) قاعدة بياناتها منفصلة؛ البيانات اللي فيها ما بتنتقل للسيرفر تلقائياً.

---

## 1) شو تشتري من GoDaddy

| الشي | الرابط | ملاحظات |
|---|---|---|
| **VPS Hosting** (ضروري) | https://www.godaddy.com/hosting/vps-hosting | اختار **Linux – Ubuntu 22.04 أو 24.04**. الحد الأدنى: **2 vCPU و 4GB RAM و 80GB SSD**. *Self-managed* بكفي. |
| **Domain** (ضروري إذا ما عندك) | https://www.godaddy.com/domains | ممكن تستخدم subdomain من دومين موجود، مثل `projectflow.yourcompany.com`. |
| **Professional Email** (اختياري) | https://www.godaddy.com/email/professional-business-email | لإرسال تذكيرات الإيميل من عنوان باسم شركتك. ممكن بدلها تستخدم Gmail. |

**لا تشتري** "Web Hosting / cPanel" العادي: ما فيه PostgreSQL وما بشغّل البرامج اللي لازم تضل شغّالة (السيرفر + محرك التذكيرات).

بعد الشراء رح يوصلك من GoDaddy: **عنوان IP للسيرفر** و**كلمة سر root** (أو بتعملها من لوحة التحكم ← *Server* ← *Settings*).

## 2) وجّه الدومين على السيرفر (DNS)

GoDaddy ← **My Products** ← الدومين ← **DNS** ← **Add New Record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `projectflow` (أو `@` للدومين الرئيسي) | عنوان IP تبع الـ VPS | 600 |

استنى 5–30 دقيقة. للتأكد افتح PowerShell على جهازك واكتب:
```
nslookup projectflow.yourcompany.com
```
لازم يرجّع عنوان IP السيرفر.

## 3) ادخل على السيرفر

من PowerShell على جهازك:
```
ssh root@SERVER_IP
```
(أول مرة اكتب `yes`، وبعدين كلمة سر root.)

## 4) نزّل الكود على السيرفر

الـ repo خاص (private)، فبتحتاج **GitHub token** للقراءة:
GitHub ← Settings ← Developer settings ← **Fine-grained tokens** ← Generate ← اختار repo `PM-Solution` ← صلاحية **Contents: Read-only**.

على السيرفر:
```
apt-get update && apt-get install -y git
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/AbdM1998/PM-Solution.git /opt/projectflow
cd /opt/projectflow
```
لما يطلب **Username** اكتب اسم حسابك على GitHub، و**Password** الصق الـ token.
(`GIT_LFS_SKIP_SMUDGE=1` بتمنعه ينزّل ملف الـ installer تبع ويندوز — 240MB ما بحتاجها السيرفر.)

## 5) شغّل سكربت التجهيز (مرة وحدة)

```
sudo bash deploy/setup-server.sh
```
رح يسألك عن:
1. **الدومين** — مثلاً `projectflow.yourcompany.com`
2. **إيميل المدير** و**اسمه** و**كلمة سره** — هذا حساب الـ Admin الوحيد
3. **إيميل لشهادة HTTPS** (Let's Encrypt بتبعتلك عليه تنبيهات)

وهو لحاله بيعمل: تنزيل Docker و Nginx، جدار حماية (بس 22/80/443)، توليد كل كلمات السر والمفاتيح،
بناء وتشغيل النظام (**أول مرة 5–15 دقيقة**)، شهادة HTTPS مجانية، ونسخة احتياطية يومية الساعة 2:30 بالليل.

بالآخر بيطبعلك الرابط. افتحه وسجّل دخول بإيميل وكلمة سر المدير.

## 6) أضف المستخدمين

**Admin ← Users ← New user**: الاسم، الإيميل، كلمة سر مبدئية، ورقم الواتساب (بالصيغة الدولية بدون + أو 00، مثل `9627XXXXXXXX`).
التسجيل الذاتي مقفول (`ALLOW_REGISTRATION=false`)، يعني ما حدا بقدر يعمل حساب غيرك.
من نفس الصفحة: إعادة تعيين كلمة السر، تعطيل حساب (بتضل مشاريعه)، أو إعطاء صلاحية Admin.

## 7) تفعيل الإيميل (SMTP)

عدّل ملف الإعدادات على السيرفر:
```
nano /opt/projectflow/.env
```
واملأ:
```
SMTP_HOST=smtp.office365.com        # GoDaddy Professional Email (Microsoft 365)
SMTP_PORT=587
SMTP_USER=reminders@yourcompany.com
SMTP_PASS=كلمة سر الإيميل
SMTP_FROM=ProjectFlow <reminders@yourcompany.com>
```
- **GoDaddy Workspace Email** (القديم): `SMTP_HOST=smtpout.secureserver.net` و `SMTP_PORT=465`
- **Gmail**: `smtp.gmail.com` و `587`، وكلمة السر لازم تكون **App Password** (مش كلمة سر حسابك) — من https://myaccount.google.com/apppasswords

احفظ (`Ctrl+O` ثم `Enter` ثم `Ctrl+X`) وطبّق:
```
sudo /opt/projectflow/deploy/update.sh
```
بعدها **Admin ← Notifications ← Send a test email**. لازم يطلع أخضر "Sent to …" وتوصلك الرسالة.

## 8) تفعيل الواتساب (WhatsApp Business Cloud API من Meta)

1. ادخل https://business.facebook.com واعمل **Business Portfolio** (إذا ما عندك).
2. ادخل https://developers.facebook.com ← **My Apps ← Create App** ← نوع **Business** ← أضف منتج **WhatsApp**.
3. **WhatsApp ← API Setup**: أضف رقم هاتف للشركة (رقم **مش مستخدم** على تطبيق واتساب عادي) وتحقق منه.
   انسخ **Phone number ID**.
4. **Token دائم**: Business Settings ← **Users ← System users ← Add** (Admin) ← **Generate token** ←
   اختار التطبيق ← صلاحيات `whatsapp_business_messaging` و `whatsapp_business_management` ← Expiration: **Never**.
5. **قالب رسالة (Template)** — ضروري لأن التذكير رسالة بتبدأها الشركة:
   WhatsApp Manager ← **Message templates ← Create** ← Category: **Utility** ← الاسم مثلاً `task_reminder` ← اللغة **Arabic** ←
   النص مثلاً:
   ```
   🔔 {{1}}
   {{2}}
   ```
   (`{{1}}` = عنوان التذكير، `{{2}}` = التفاصيل.) استنى الموافقة (عادة دقائق).
6. في `/opt/projectflow/.env`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=الرقم من خطوة 3
   WHATSAPP_ACCESS_TOKEN=الـ token من خطوة 4
   WHATSAPP_TEMPLATE_NAME=task_reminder
   WHATSAPP_TEMPLATE_LANG=ar
   ```
   وطبّق: `sudo /opt/projectflow/deploy/update.sh`
7. **Admin ← Notifications ← Send a test WhatsApp message** لرقمك.

> Meta بتحاسب على المحادثات حسب الدولة (أول عدد محادثات شهرياً مجاني حسب سياستهم الحالية). التفاصيل: https://developers.facebook.com/docs/whatsapp/pricing

## 9) كيف بتشتغل التذكيرات

- كل مستخدم بيضيف تذكير على مشروع أو مهمة أو بند checklist، ويختار القنوات: **In-app / Email / WhatsApp**.
- الإيميل بروح على إيميل الحساب (أو إيميل تكتبه بالتذكير). الواتساب بروح على الرقم المكتوب بالتذكير، وإذا ما في، على رقم المستخدم من **Admin ← Users**.
- **Admin ← Reminders**: كل تذكيرات النظام، مع إيقاف وتشغيل.
- **Admin ← Notifications ← Delivery log**: كل محاولة إرسال وشو صار فيها (Sent / Simulated / Failed مع سبب الخطأ).

## 10) الصيانة

| شو بدك | الأمر (على السيرفر) |
|---|---|
| تحديث لآخر نسخة من GitHub | `sudo /opt/projectflow/deploy/update.sh` |
| نسخة احتياطية الآن | `sudo /opt/projectflow/deploy/backup.sh` |
| وين النسخ الاحتياطية | `/var/backups/projectflow` (آخر 14 يوم) |
| حالة الخدمات | `cd /opt/projectflow && docker compose -f docker-compose.prod.yml ps` |
| سجلات الأخطاء | `docker compose -f docker-compose.prod.yml logs --tail 100 api worker` |
| إعادة تشغيل | `docker compose -f docker-compose.prod.yml restart` |

الاسترجاع من نسخة احتياطية: الأوامر مكتوبة بأول ملف `deploy/backup.sh`.
**نصيحة**: انسخ مجلد `/var/backups/projectflow` لمكان تاني بشكل دوري (جهازك أو Google Drive)، لأنه إذا راح السيرفر بتروح النسخ معه.

## 11) مشاكل شائعة

| المشكلة | الحل |
|---|---|
| شهادة HTTPS فشلت | الـ DNS لسا ما وصل. تأكد بـ `nslookup`، وبعدين: `certbot --nginx -d الدومين --redirect` |
| البناء وقف أو "Killed" | الذاكرة قليلة. السكربت بيضيف swap تلقائياً إذا الـ RAM أقل من 4GB. شغّل `update.sh` مرة تانية |
| "Could not reach the server" | `docker compose -f docker-compose.prod.yml ps` لازم كل الخدمات `running/healthy`. شوف `logs api` |
| الإيميل "Simulated" | `SMTP_HOST` فاضي، أو ما شغّلت `update.sh` بعد تعديل `.env` |
| الواتساب Failed: (#131047) | أُرسل نص عادي برا نافذة الـ 24 ساعة. عيّن `WHATSAPP_TEMPLATE_NAME` لقالب معتمد |
| الواتساب Failed: (#132001) | اسم القالب أو لغته (`WHATSAPP_TEMPLATE_LANG`) ما بتطابق القالب المعتمد |
| نسيت كلمة سر المدير | على السيرفر: `sudo /opt/projectflow/deploy/reset-password.sh you@example.com 'NewPassword123'` (تغيير `ADMIN_PASSWORD` بـ `.env` ما بيغيّر كلمة سر حساب موجود — بيستخدم بس أول مرة) |
