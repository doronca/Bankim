# Financial Dashboard

Local, secure, bilingual (Hebrew/English) multi-entity financial dashboard covering
OpenFinance (Israeli banks/cards), Interactive Brokers, and Fair.co.il statements.

Everything runs on your own machine. No data leaves it except calls you make yourself
to OpenFinance and IBKR to pull *your* data.

> A Hebrew version of this document follows below: **[גרסה בעברית ⬇](#לוח-בקרה-פיננסי)**

This project is dedicated to my father, who always said he was "עובר על הבנקים" —
going through the banks. This dashboard carries that habit on.

---

## Prerequisites

- **Node.js 20+** and **npm** (check with `node -v`)
- macOS, Linux, or Windows with [WSL](https://learn.microsoft.com/windows/wsl/install) (native Windows works too, see [Platform support](#platform-support-desktopmobile))
- (Optional, for real bank sync) an [OpenFinance / Financy](https://docs.open-finance.ai) API user id, client id, and client secret
- (Optional, for IBKR sync) an Interactive Brokers account with a Flex Query + Flex Token configured in Client Portal → Reports → Flex Queries

## Install

```bash
npm install
```

Copy the credentials template and fill in what you have (all fields are optional —
leave blank and skip that data source):

```bash
cp .env.example .env
chmod 600 .env
```

```
OPENFINANCE_USER_ID=...
OPENFINANCE_CLIENT_ID=...
OPENFINANCE_CLIENT_SECRET=...
IBKR_FLEX_TOKEN=...
IBKR_FLEX_QUERY_ID=...
```

`.env` and `*.db` are gitignored — never commit them.

Create the local database:

```bash
npx prisma migrate deploy
```

## Run

From the `Banking` project folder (where `package.json` lives):

```bash
npm run dev
```

Open **http://localhost:3000**. To stop it, press `Ctrl+C` in that terminal.

## First-time setup

1. A fresh install starts with a single implicit entity — no switcher shown, everything
   just works. Go to **Account Mapping** to connect data sources.
2. **Manage entities** (gear icon next to the entity switcher, or the link at the top
   of the sidebar if only one exists yet) lets you add, rename, or delete entities —
   e.g. "Parents", "Personal", "Company". Once you have 2+, a switcher appears in the
   sidebar with an **Aggregate view** option.
3. Click **Sync OpenFinance** to pull bank/card accounts (after completing the one-time
   bank consent flow — pick your bank, authenticate, then sync), **Sync IBKR** for
   brokerage data, or drop a Fair.co.il CSV/XLS file.
4. Assign each discovered account/card/portfolio to an entity, or give it a memorable
   **nickname**.
5. Use the entity switcher (if you have more than one) or **Aggregate view** to see
   isolated or combined dashboards.
6. In **Transactions**, click a category pill to recategorize — choose whether the
   change applies to just that transaction, that merchant within the current entity,
   or that merchant everywhere. Rules are remembered and auto-applied going forward.
   Filter the list by category, account/card, or a merchant text search, and attach a
   free-text **note** to any individual transaction.
7. **Categories**: on Account Mapping, apply the built-in **household** or **business**
   category presets (or build your own), then group related categories under a parent
   — e.g. Groceries + Electricity + Water + Property Tax under "Home Maintenance" — via
   **Category groups**. The dashboard's category breakdown can toggle between raw
   categories and grouped totals.
8. **Subscriptions** separates genuine recurring charges (regular weekly/monthly/etc.
   cadence) from one-off or irregular expenses, and flags any recurring charge that
   jumped more than 10%. Cadence detection isn't always right — use **mark not a
   subscription** / **mark as subscription** to correct it manually (including for a
   subscription that's only charged once so far, via the merchant search box).
9. Credit card accounts on **Account Mapping** show an **estimated billing day**
   (inferred from the matching lump-sum charge in the linked bank account — only shown
   when there's enough history to be confident). The dashboard shows this month's and
   total card spend, plus a **predicted next charge**: the sum of charges OpenFinance
   has already posted but not yet billed — a real pending total, not a forecast.
10. The **Ask / set a rule** box on the dashboard understands a small fixed set of
    commands (it's rule-based, not AI) — type "help" to see them.

## Preferences

Bottom of the sidebar: **Theme** (Light / Dark / System) and **Text size**
(Small / Medium / Large / Extra large) apply instantly and persist across sessions.
The language switcher sits in the corner matching the current reading direction
(top-right in Hebrew, top-left in English).

## Platform support (desktop/mobile)

This is a web app you run locally with `npm run dev` — it's not a native iOS/Android/
Windows app, but it's usable from any of them:

- **This Mac (or whatever machine runs it):** open `http://localhost:3000` in any
  browser.
- **iPhone / Android / another computer on the same Wi-Fi:** `npm run dev` also
  prints a `http://<your-local-ip>:3000` address — open that from your phone's
  browser. Nothing needs installing; it's fully responsive.
- **Windows:** works natively (Node.js + npm run the same way) or under WSL.
- **Away from home:** there's no public server — you'd need to set up your own
  (e.g. a Tailscale/VPN link to your machine, or deploying it somewhere yourself).
  That's a deliberate trade-off for keeping financial data local by default.

## Security

- Everything runs strictly on `localhost` (or your local network if you open it up).
- API credentials live only in your local `.env` (`chmod 600`, gitignored).
- All external API access is read-only — nothing here initiates transfers or trades.
- No external telemetry or analytics.

## Updating

When new features are added, update the app with:

```bash
git pull   # if using git
npm install
npx prisma migrate deploy
npm run dev
```

This README is kept in sync with the feature set — check back here after an update.

---

# לוח בקרה פיננסי

לוח בקרה פיננסי מקומי, מאובטח ודו-לשוני (עברית/אנגלית) לניהול מספר ישויות פיננסיות,
המחבר בין OpenFinance (בנקים וכרטיסי אשראי ישראליים), Interactive Brokers ודוחות
Fair.co.il.

הכול רץ על המחשב שלכם. שום מידע לא יוצא ממנו, מלבד קריאות שאתם עצמכם מפעילים אל
OpenFinance ו-IBKR כדי למשוך את *הנתונים שלכם*.

הפרויקט מוקדש לזכר אבא שלי, שתמיד אמר שהוא "עובר על הבנקים". הדשבורד הזה ממשיך את
ההרגל הזה.

## דרישות מוקדמות

- **Node.js גרסה 20 ומעלה** ו-**npm** (בדקו עם `node -v`)
- macOS, Linux, או Windows עם [WSL](https://learn.microsoft.com/windows/wsl/install) (גם Windows רגיל עובד, ראו [תמיכה בפלטפורמות](#תמיכה-בפלטפורמות-נייד-שולחני))
- (אופציונלי, לסנכרון בנקים אמיתי) פרטי משתמש API של [OpenFinance / Financy](https://docs.open-finance.ai) — מזהה משתמש, מזהה לקוח וסוד לקוח
- (אופציונלי, לסנכרון IBKR) חשבון Interactive Brokers עם Flex Query + Flex Token מוגדרים ב-Client Portal ← Reports ← Flex Queries

## התקנה

```bash
npm install
```

העתיקו את קובץ תבנית ההרשאות ומלאו את מה שיש לכם (כל השדות אופציונליים — אפשר להשאיר
ריק ולדלג על אותו מקור מידע):

```bash
cp .env.example .env
chmod 600 .env
```

```
OPENFINANCE_USER_ID=...
OPENFINANCE_CLIENT_ID=...
OPENFINANCE_CLIENT_SECRET=...
IBKR_FLEX_TOKEN=...
IBKR_FLEX_QUERY_ID=...
```

הקבצים `.env` וגם `*.db` נמצאים ב-gitignore — לעולם אל תעשו להם commit.

צרו את מסד הנתונים המקומי:

```bash
npx prisma migrate deploy
```

## הפעלה

מתוך תיקיית הפרויקט `Banking` (שבה נמצא `package.json`):

```bash
npm run dev
```

פתחו **http://localhost:3000**. כדי לעצור, הקישו `Ctrl+C` בטרמינל הזה.

## הגדרה ראשונית

1. התקנה חדשה מתחילה עם ישות אחת מובלעת — בלי בורר, הכול פשוט עובד. עברו ל-**שיוך
   חשבונות** כדי לחבר מקורות מידע.
2. **ניהול ישויות** (סמל גלגל השיניים ליד בורר הישות, או הקישור בראש התפריט הצדי אם
   קיימת רק ישות אחת) מאפשר להוסיף, לשנות שם או למחוק ישויות — למשל "הורים",
   "אישי", "חברה". ברגע שיש 2 ומעלה, בורר יופיע בתפריט הצדי עם אפשרות **תצוגה
   מאוחדת**.
3. לחצו על **סנכרן OpenFinance** למשיכת חשבונות בנק/כרטיסים (לאחר השלמת תהליך
   ההסכמה החד-פעמי מול הבנק — בחירת בנק, אימות, ואז סנכרון), **סנכרן IBKR** לנתוני
   ברוקראז', או גררו קובץ CSV/XLS של Fair.co.il.
4. שייכו כל חשבון/כרטיס/תיק שהתגלה לישות מסוימת, או תנו לו **כינוי** קל לזיהוי.
5. השתמשו בבורר הישויות (אם יש יותר מאחת) או ב-**תצוגה מאוחדת** כדי לראות דשבורדים
   מבודדים או משולבים.
6. במסך **תנועות**, לחצו על תגית הקטגוריה כדי לשנות אותה — בחרו אם השינוי חל רק על
   התנועה הזו, על בית העסק בישות הנוכחית, או על בית העסק בכל הישויות. הכללים נשמרים
   ומיושמים אוטומטית מכאן ואילך. ניתן לסנן את הרשימה לפי קטגוריה, חשבון/כרטיס, או
   חיפוש טקסט בבית עסק, וגם לצרף **הערה** חופשית לכל תנועה בנפרד.
7. **קטגוריות**: במסך שיוך חשבונות אפשר להוסיף את חבילות הקטגוריות המובנות ל-**משק
   בית** או **עסק** (או לבנות משלכם), ואז לאגד קטגוריות קשורות תחת קטגוריית-על — למשל
   קניות מזון + חשמל + מים + ארנונה תחת "אחזקת הבית" — דרך **קבוצות קטגוריות**. פילוח
   הקטגוריות בדשבורד ניתן למעבר בין קטגוריות גולמיות לסכומים מאוגדים.
8. **מנויים** מפריד חיובים חוזרים אמיתיים (בקצב שבועי/חודשי/וכו' סדיר) מהוצאות
   חד-פעמיות או בלתי סדירות, ומסמן כל חיוב חוזר שקפץ ביותר מ-10%. זיהוי הקצב לא תמיד
   מדויק — אפשר לתקן ידנית עם **סמן כלא-מנוי** / **סמן כמנוי** (כולל עבור מנוי שחויב
   רק פעם אחת עד כה, דרך תיבת החיפוש).
9. חשבונות כרטיס אשראי במסך שיוך חשבונות מציגים **יום חיוב משוער** (מוסק מהתאמת
   החיוב הכולל בחשבון הבנק המקושר — מוצג רק כשיש מספיק היסטוריה לביטחון). הדשבורד
   מציג הוצאות אשראי החודש וסך-הכל, וגם **חיוב צפוי הבא**: סכום החיובים שכבר נקלטו
   ב-OpenFinance אך טרם חויבו בפועל — סכום ממתין אמיתי, לא תחזית.
10. תיבת **שאל / הגדר כלל** בדשבורד מבינה קבוצה קבועה וקטנה של פקודות (מבוססת חוקים,
    לא בינה מלאכותית) — הקלידו "עזרה" כדי לראותן.

## העדפות

בתחתית התפריט הצדי: **ערכת נושא** (בהיר / כהה / מערכת) ו-**גודל טקסט** (קטן / רגיל
/ גדול / גדול מאוד) חלים מיידית ונשמרים בין הפעלות. מחליף השפה יושב בפינה המתאימה
לכיוון הקריאה הנוכחי (למעלה מימין בעברית, למעלה משמאל באנגלית).

## תמיכה בפלטפורמות (נייד/שולחני)

זוהי אפליקציית web שמריצים מקומית עם `npm run dev` — לא אפליקציה טבעית ל-iOS/
Android/Windows, אבל אפשר להשתמש בה מכל אחד מהם:

- **המחשב הזה (או כל מחשב שמריץ אותה):** פתחו `http://localhost:3000` בכל דפדפן.
- **אייפון / אנדרואיד / מחשב אחר על אותה רשת Wi-Fi:** `npm run dev` גם מדפיס כתובת
  `http://<כתובת-ה-IP-המקומית-שלכם>:3000` — פתחו אותה מהדפדפן בטלפון. אין צורך
  להתקין כלום; העיצוב מגיב לגודל המסך.
- **Windows:** עובד באופן טבעי (Node.js ו-npm רצים באותו אופן) או תחת WSL.
- **מרחוק, לא בבית:** אין שרת ציבורי — יהיה עליכם להקים כזה בעצמכם (למשל קישור
  Tailscale/VPN למחשב שלכם, או פריסה עצמאית במקום אחר). זוהי החלטה מכוונת כדי לשמור
  את המידע הפיננסי מקומי כברירת מחדל.

## אבטחה

- הכול רץ אך ורק על `localhost` (או ברשת המקומית שלכם אם תפתחו זאת).
- פרטי ה-API חיים רק בקובץ `.env` המקומי שלכם (`chmod 600`, ב-gitignore).
- כל הגישה ל-API חיצוני היא לקריאה בלבד — שום דבר כאן לא מבצע העברות או עסקאות.
- אין טלמטריה או אנליטיקס חיצוניים.

## עדכון

כשמתווספות תכונות חדשות, עדכנו את האפליקציה עם:

```bash
git pull   # אם משתמשים ב-git
npm install
npx prisma migrate deploy
npm run dev
```

מסמך ה-README הזה מתעדכן בהתאם לתכונות הקיימות — בדקו כאן שוב אחרי עדכון.
