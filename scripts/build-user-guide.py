# -*- coding: utf-8 -*-
import os
from datetime import date
from bidi.algorithm import get_display
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.environ.get("GUIDE_SHOTS_DIR", os.path.join(HERE, ".guide-shots"))
OUT = os.environ.get("GUIDE_OUT", os.path.join(HERE, "..", "public", "docs", "user-guide.pdf"))

pdfmetrics.registerFont(TTFont("Heb", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))

PAGE_W, PAGE_H = A4
MARGIN = 50
CONTENT_W = PAGE_W - 2 * MARGIN

PRIMARY = (0.30, 0.25, 0.85)  # indigo-ish, matches app's primary
DARK = (0.12, 0.16, 0.22)
GRAY = (0.35, 0.4, 0.47)
LIGHT_BG = (0.95, 0.96, 0.98)

c = canvas.Canvas(OUT, pagesize=A4)


def rtl(text):
    return get_display(text)


def set_color(rgb):
    c.setFillColorRGB(*rgb)


def wrap_text(text, font, size, max_width):
    words = text.split(" ")
    lines = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_paragraph(text, x_right, y, size=14, font="Heb", color=DARK, max_width=CONTENT_W, leading=None):
    leading = leading or size * 1.5
    set_color(color)
    c.setFont(font, size)
    for para in text.split("\n"):
        if not para.strip():
            y -= leading * 0.6
            continue
        for line in wrap_text(para, font, size, max_width):
            if y < MARGIN + 30:
                c.showPage()
                set_color(PRIMARY)
                c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
                y = PAGE_H - 60
                set_color(color)
                c.setFont(font, size)
            c.drawRightString(x_right, y, rtl(line))
            y -= leading
    return y


def page_header(title_he, page_num=None):
    set_color(PRIMARY)
    c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
    set_color(GRAY)
    c.setFont("Heb", 11)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 30, rtl("מדריך למשתמש — לוח בקרה פיננסי"))
    c.setFont("Helvetica", 11)
    c.drawString(MARGIN, PAGE_H - 30, "Bankim")
    if page_num:
        c.drawCentredString(PAGE_W / 2, MARGIN / 2, str(page_num))


def new_page():
    c.showPage()


def section_title(text, y=PAGE_H - 70):
    set_color(PRIMARY)
    size = 26
    while size > 15 and pdfmetrics.stringWidth(text, "Heb", size) > CONTENT_W:
        size -= 1
    if pdfmetrics.stringWidth(text, "Heb", size) > CONTENT_W:
        lines = wrap_text(text, "Heb", size, CONTENT_W)
    else:
        lines = [text]
    c.setFont("Heb", size)
    for line in lines:
        c.drawRightString(PAGE_W - MARGIN, y, rtl(line))
        y -= size * 1.25
    set_color(PRIMARY)
    c.setLineWidth(1.2)
    c.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5)
    return y - 35


def fit_image(path, max_w, max_h):
    img = ImageReader(path)
    iw, ih = img.getSize()
    ratio = min(max_w / iw, max_h / ih)
    return img, iw * ratio, ih * ratio


def draw_screenshot(path, y_top, caption=None, max_h=300):
    img, w, h = fit_image(path, CONTENT_W, max_h)
    if y_top - h < MARGIN + 30:
        c.showPage()
        set_color(PRIMARY)
        c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=1, stroke=0)
        y_top = PAGE_H - 60
    x = MARGIN + (CONTENT_W - w) / 2
    y = y_top - h
    set_color((0.85, 0.87, 0.9))
    c.setLineWidth(1)
    c.rect(x - 2, y - 2, w + 4, h + 4, fill=0, stroke=1)
    c.drawImage(img, x, y, width=w, height=h)
    y -= 14
    if caption:
        set_color(GRAY)
        c.setFont("Heb", 12)
        c.drawCentredString(PAGE_W / 2, y, rtl(caption))
        y -= 14
    return y


# ---------- Cover page ----------
set_color(PRIMARY)
c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
set_color((1, 1, 1))
c.setFont("Heb", 44)
c.drawCentredString(PAGE_W / 2, PAGE_H - 260, rtl("מדריך למשתמש"))
c.setFont("Heb", 26)
c.drawCentredString(PAGE_W / 2, PAGE_H - 300, rtl("לוח בקרה פיננסי מאוחד"))
c.setFont("Helvetica", 15)
c.drawCentredString(PAGE_W / 2, PAGE_H - 330, "Bankim — Personal Finance Dashboard")

c.setFont("Heb", 15)
c.drawCentredString(PAGE_W / 2, 120, rtl(f"עודכן לאחרונה: {date.today().strftime('%d/%m/%Y')}"))
c.setFont("Heb", 12)
set_color((0.9, 0.9, 1))
c.drawCentredString(
    PAGE_W / 2, 95,
    rtl("מדריך זה מתעדכן בכל שינוי משמעותי במערכת — ראו הוראות עדכון בעמוד האחרון"),
)
new_page()

# ---------- Table of contents ----------
page_header("תוכן עניינים")
y = section_title("תוכן עניינים")
toc = [
    "1. מבוא — מה זה Bankim ואיך המערכת בנויה",
    "2. ניווט כללי — סרגל הצד וההעדפות",
    "3. שיוך חשבונות — חיבור בנקים, IBKR והעלאת קבצים",
    "4. הדשבורד הראשי",
    "5. תנועות (עסקאות)",
    "6. תחזית הוצאות (כרטיסי אשראי)",
    "7. מנויים וחיובים חוזרים",
    "8. ניהול ישויות (משק בית / חברה / בני משפחה)",
    "9. קטגוריות, תובנות ומשימות",
    "10. שאלות נפוצות ופתרון תקלות",
    "11. עדכון המדריך",
]
for line in toc:
    y = draw_paragraph(line, PAGE_W - MARGIN, y, size=15, leading=28)
new_page()

# ---------- 1. Intro ----------
page_header("מבוא")
y = section_title("1. מבוא")
y = draw_paragraph(
    "Bankim הוא לוח בקרה פיננסי אישי המרכז במקום אחד את כל החשבונות שלכם — חשבונות עו\"ש, "
    "כרטיסי אשראי ותיקי השקעות — מכמה בנקים וברוקרים, ומציג תמונה מאוחדת של המצב הפיננסי: "
    "תנועות, תזרים מזומנים, תחזית חיובים עתידיים בכרטיסי האשראי, מנויים וחיובים חוזרים, ותובנות "
    "אוטומטיות.",
    PAGE_W - MARGIN, y,
)
y -= 10
y = draw_paragraph(
    "המערכת בנויה סביב כמה מסכים עיקריים, נגישים תמיד מסרגל הצד בצד ימין של המסך: "
    "דשבורד, תנועות, תחזית הוצאות, מנויים, ושיוך חשבונות. סעיפי המדריך הבאים עוברים על כל אחד מהם.",
    PAGE_W - MARGIN, y,
)
new_page()

# ---------- 2. Navigation ----------
page_header("ניווט כללי")
y = section_title("2. ניווט כללי — סרגל הצד וההעדפות")
y = draw_paragraph(
    "סרגל הצד (בצד ימין) קיים בכל מסכי המערכת וכולל:",
    PAGE_W - MARGIN, y,
)
bullets = [
    "• שם היישום ומתג הרחבה/כיווץ של הסרגל.",
    "• מחליף שפה (עברית/English) מעל תפריט הניווט.",
    "• בורר ישות — מופיע רק כשיש יותר מישות פיננסית אחת (ראו סעיף 8), ומאפשר לעבור בין תצוגה מאוחדת לתצוגה של ישות בודדת.",
    "• תפריט ניווט לחמשת המסכים הראשיים: דשבורד, תנועות, תחזית הוצאות, מנויים, שיוך חשבונות.",
    "• בתחתית הסרגל — פאנל העדפות: ערכת נושא (בהיר/כהה/לפי מערכת), גודל טקסט (מקטן ועד גדול מאוד), והפעלה/כיבוי של הסברים (סימני '?' עם רמזים) בכל המסכים.",
]
for b in bullets:
    y = draw_paragraph(b, PAGE_W - MARGIN, y, leading=21)
    y -= 4
y -= 6
y = draw_paragraph(
    "טיפ: אם אתם חדשים במערכת, השאירו את 'הצג הסברים' פעיל — סימני ה-'?' לצד שדות ומושגים מסבירים בדיוק מה כל דבר עושה.",
    PAGE_W - MARGIN, y, color=GRAY, size=13,
)
new_page()

# ---------- 3. Onboarding ----------
page_header("שיוך חשבונות")
y = section_title("3. שיוך חשבונות — חיבור בנקים, IBKR והעלאת קבצים")
y = draw_paragraph(
    "זהו מסך ההתקנה וההגדרה של המערכת: כאן מחברים חשבונות בנק וכרטיסי אשראי, מסנכרנים תיק השקעות, "
    "ומגדירים קטגוריות. יש להתחיל כאן לפני שהנתונים יופיעו במסכים האחרים.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_screenshot(os.path.join(SHOTS, "onboarding.png"), y, "מסך שיוך חשבונות")
new_page()
page_header("שיוך חשבונות")
y = PAGE_H - 70
y = draw_paragraph("שלוש דרכים לחבר מקורות נתונים:", PAGE_W - MARGIN, y, size=16)
y -= 4
y = draw_paragraph(
    "א. OpenFinance (בנקים בישראל) — לוחצים 'התחל חיבור', בוחרים בנק ומזינים תעודת זהות. "
    "החיבור דורש רישום מוקדם באתר open-finance.ai וקבלת מפתחות (OPENFINANCE_USER_ID, "
    "OPENFINANCE_CLIENT_ID, OPENFINANCE_CLIENT_SECRET) שיש להזין לקובץ .env בשורש הפרויקט, "
    "ולאחר מכן להפעיל מחדש את השרת (npm run dev).",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 8
y = draw_paragraph(
    "ב. Interactive Brokers (IBKR) — סנכרון תיק השקעות. יש ליצור ב-IBKR Flex Query עבור "
    "Activity ואסימון Flex Web Service Token, ולהזין אותם כ-IBKR_FLEX_QUERY_ID ו-IBKR_FLEX_TOKEN "
    "בקובץ .env. שימו לב — לאסימון תוקף מוגבל (בדרך כלל עד שנה) ויש לחדשו כשפג.",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 8
y = draw_paragraph(
    "ג. Fair.co.il (קרנות/גמל/פנסיה, ללא API) — מורידים מאתר Fair דוח שווי תיק (CSV או Excel) "
    "ומעלים אותו בכפתור 'העלאת קובץ'. הקובץ חייב לכלול עמודות תאריך ושווי כולל "
    "('תאריך' ו'שווי'/'שווי תיק', או date/value/balance באנגלית).",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 10
y = draw_paragraph(
    "לאחר החיבור, כל חשבון שמתגלה מופיע ברשימת 'חשבונות' למטה, שם אפשר: לתת לו כינוי אישי, "
    "לשייך אותו לישות (ראו סעיף 8), למזג כפילויות (כשאותו חשבון מדווח פעמיים תחת מזהים שונים), "
    "ולהגדיר לכרטיסי אשראי את יום החיוב החודשי — בלעדיו לא ניתן להציג תחזית חיובים עתידיים.",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 10
y = draw_paragraph(
    "לפרטים המדויקים והעדכניים ביותר על מפתחות והגדרות, לחצו על הקישור 'מדריך התקנה' בראש מסך "
    "שיוך החשבונות — הוא נפתח כחלון קופץ עם הסבר לכל שיטת חיבור בנפרד.",
    PAGE_W - MARGIN, y, color=GRAY, size=13, leading=18,
)
new_page()

# ---------- 4. Dashboard ----------
page_header("הדשבורד")
y = section_title("4. הדשבורד הראשי")
y = draw_paragraph(
    "מסך הבית מציג תמונת מצב מיידית: כרטיס סיכום לכל ישות (יתרת חוב/זכות לכרטיסי אשראי), "
    "כרטיסי חשבונות עם סכום ממתין לחיוב ותאריך חיוב קרוב, אזור תובנות והתראות (למשל התייקרות "
    "של חיוב חוזר), ותיבת שאלה חופשית בתחתית המסך לשאילת שאלות על הנתונים בשפה טבעית.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_screenshot(os.path.join(SHOTS, "dashboard.png"), y, "הדשבורד הראשי")
new_page()

# ---------- 5. Transactions ----------
page_header("תנועות")
y = section_title("5. תנועות (עסקאות)")
y = draw_paragraph(
    "טבלת כל התנועות מכל החשבונות המשויכים, עם סינון לפי טווח תאריכים, סוג חשבון, כיוון "
    "(הכנסות/הוצאות), קטגוריה, חשבון ספציפי, וחיפוש חופשי לפי בית עסק/קטגוריה/הערה. "
    "אפשר גם להסתיר תנועות עתידיות ולהציג יתרה מצטברת כשבוחרים חשבון בודד.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_screenshot(os.path.join(SHOTS, "transactions.png"), y, "מסך תנועות")
new_page()
page_header("תנועות")
y = PAGE_H - 70
y = draw_paragraph(
    "לכל תנועה אפשר: לשנות קטגוריה (ואפשר לבקש מהמערכת ליצור כלל אוטומטי לפעם הבאה שאותו בית "
    "עסק יופיע), להוסיף הערה פרטית, וליצור ממנה משימה (to-do) עם תאריך יעד אופציונלי שתופיע גם "
    "ברשימת המשימות בדשבורד.",
    PAGE_W - MARGIN, y, leading=19,
)
new_page()

# ---------- 6. Forecast ----------
page_header("תחזית הוצאות")
y = section_title("6. תחזית הוצאות (כרטיסי אשראי)")
y = draw_paragraph(
    "מציג מה עומד לרדת בכל כרטיס אשראי ומתי — סכום ממתין לחיוב, תאריך החיוב המשוער (מבוסס "
    "על יום החיוב שהוגדר לכרטיס), ומספר התנועות שממתינות. שימושי לתכנון תזרים מזומנים קדימה.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_screenshot(os.path.join(SHOTS, "forecast.png"), y, "מסך תחזית הוצאות")
y -= 8
y = draw_paragraph(
    "אם כרטיס מציג 'לא זוהה תאריך חיוב קבוע' — יש להיכנס להגדרות הכרטיס במסך שיוך חשבונות "
    "ולקבוע את יום החיוב (או לסמן שמדובר בכרטיס דביט עם חיוב מיידי, ללא מחזור חודשי).",
    PAGE_W - MARGIN, y, color=GRAY, size=13,
)
new_page()

# ---------- 7. Subscriptions ----------
page_header("מנויים")
y = section_title("7. מנויים וחיובים חוזרים")
y = draw_paragraph(
    "המערכת מזהה אוטומטית בתי עסק עם חיוב חוזר וקבוע (שבועי/חודשי/דו-חודשי וכו') ומציגה אותם "
    "כרשימת מנויים, כולל שינוי % במחיר לעומת החיוב הקודם — כדי להבליט התייקרויות שקל לפספס. "
    "ניתן לחפש מנוי ספציפי, ולסמן ידנית בית עסק כ'לא מנוי' או כ'מנוי' אם הזיהוי האוטומטי טעה.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_screenshot(os.path.join(SHOTS, "subscriptions.png"), y, "מסך מנויים")
new_page()

# ---------- 8. Entities ----------
page_header("ניהול ישויות")
y = section_title("8. ניהול ישויות (משק בית / חברה / בני משפחה)")
y = draw_paragraph(
    "ישות היא 'ספר' כספי נפרד: לדוגמה את/ה, בן/בת זוג, הורים, או חברה. כל חשבון משויך לישות אחת, "
    "וכל הדוחות, התחזיות והתובנות מחושבים בנפרד לכל ישות — או מאוחדים יחד בתצוגה 'כל הישויות'.",
    PAGE_W - MARGIN, y,
)
y -= 6
y = draw_paragraph(
    "בהתקנה הראשונה עם ישות אחת בלבד, בורר הישויות מוסתר והמערכת מציגה הכול תחת אותה ישות "
    "אוטומטית. ברגע שנוצרת ישות שנייה, מופיע בסרגל הצד בורר לבחירת ישות, וכפתור 'ניהול ישויות' "
    "שמאפשר להוסיף ישות חדשה (שם ואייקון אימוג'י אופציונלי) או למחוק ישות קיימת — מחיקה אינה "
    "מוחקת את החשבונות המשויכים אלא רק מבטלת את השיוך שלהם.",
    PAGE_W - MARGIN, y, leading=19,
)
new_page()

# ---------- 9. Categories/Insights/Tasks ----------
page_header("קטגוריות ותובנות")
y = section_title("9. קטגוריות, תובנות ומשימות")
y = draw_paragraph(
    "קטגוריות: כל תנועה משויכת לקטגוריה (למשל 'מכולת', 'חשמל'), וקטגוריות אפשר לקבץ תחת קבוצות "
    "(למשל 'תחזוקת בית') לסיכומים ברמה גבוהה יותר. במסך שיוך חשבונות יש כפתורים להוספת ערכת "
    "קטגוריות מוכנה מראש — למשק בית או לעסק — כדי לא להתחיל מאפס.",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 8
y = draw_paragraph(
    "תובנות והתראות: מוצגות בדשבורד ומחושבות אוטומטית — כגון זיהוי התייקרות של חיוב חוזר. "
    "אפשר לרענן את התובנות, להתעלם מהתראה, וליצור סיכום שבועי שניתן להעתיק כטקסט.",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 8
y = draw_paragraph(
    "משימות: ניתן לצרף משימה (to-do) לכל תנועה, עם תאריך יעד אופציונלי. משימות פתוחות מופיעות "
    "ברשימה מרוכזת בדשבורד, וניתן לסמן כהושלמו, לפתוח מחדש, או לדחות ('נודניק') עד מחר/שבוע הבא.",
    PAGE_W - MARGIN, y, leading=19,
)
new_page()

# ---------- 10. FAQ ----------
page_header("שאלות נפוצות")
y = section_title("10. שאלות נפוצות ופתרון תקלות")
faq = [
    ("החיבור לבנק נכשל / מופיעה שגיאת 'חסרים פרטי חיבור'",
     "יש להשלים את מפתחות ה-OpenFinance בקובץ ה-.env ולהפעיל מחדש את שרת הפיתוח. פרטים מלאים "
     "בקישור 'מדריך התקנה' במסך שיוך חשבונות."),
    ("קובץ Fair שהעליתי לא נקלט",
     "ודאו שלקובץ יש עמודת תאריך ועמודת שווי כולל בשם מזוהה ('תאריך'/'שווי' בעברית, או "
     "date/value/balance באנגלית) — שמות עמודות אחרים לא מזוהים אוטומטית."),
    ("כרטיס אשראי לא מציג תחזית חיובים",
     "היכנסו להגדרות הכרטיס במסך שיוך חשבונות וקבעו את יום החיוב החודשי, או סמנו את הכרטיס "
     "כ'חיוב מיידי' אם מדובר בכרטיס דביט."),
    ("אותו חשבון מופיע פעמיים",
     "זה קורה כשהבנק מדווח על אותו חשבון תחת שני מזהים (נפוץ ב-OpenFinance). אפשר למזג אחד "
     "לתוך השני מהגדרות החשבון — הם ימשיכו להסתנכרן בנפרד אך יוצגו כאחד בכל המערכת."),
    ("איך עוברים בין עברית לאנגלית?",
     "מתג השפה (EN/עברית) נמצא בראש סרגל הצד, ליד שם היישום."),
]
for q, a in faq:
    y = draw_paragraph(q, PAGE_W - MARGIN, y, size=15, color=PRIMARY, leading=19)
    y -= 2
    y = draw_paragraph(a, PAGE_W - MARGIN, y, size=13.5, color=DARK, leading=18)
    y -= 12
new_page()

# ---------- 11. Update instructions ----------
page_header("עדכון המדריך")
y = section_title("11. עדכון המדריך")
y = draw_paragraph(
    "מדריך זה נועד להישאר מסונכרן עם המערכת. כל פעם שמתבצע שינוי משמעותי במסכים או בתהליך "
    "שיוך החשבונות, יש לבקש לעדכן את המדריך (“עדכן את "
    "מדריך המשתמש”) — העדכון כולל "
    "צילומי מסך טריים מהאפליקציה הרצה וטקסט מותאם לשינויים.",
    PAGE_W - MARGIN, y, leading=19,
)
y -= 8
y = draw_paragraph(
    "המדריך נשמר כקובץ PDF בנתיב public/docs/user-guide.pdf בקוד המקור, ומקושר משני מקומות: "
    "מסך שיוך חשבונות (למעלה, קישור 'מדריך התקנה מלא') וסרגל הצד הראשי (זמין מכל מסך).",
    PAGE_W - MARGIN, y, leading=19, color=GRAY, size=13,
)

c.save()
print("done:", OUT)
