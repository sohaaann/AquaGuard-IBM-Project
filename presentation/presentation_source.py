"""Builds diagrams, the editable PowerPoint and PRESENTER_NOTES.md for the standalone-HTML AquaGuard AI.

Dev-time tool only (the app needs none of this).  Usage, from the repository root:
    node scripts/compute_facts.js        # figures computed by the real app code -> presentation/facts.json
    node tests/unit.test.js && node tests/e2e.js   # test results -> tests/results.json, screenshots/ (real screenshots)
    python presentation/presentation_source.py     # needs python-pptx, matplotlib, pillow
Every number on a result slide is read from facts.json / tests/results.json; screenshots are real captures from screenshots/.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402
from PIL import Image  # noqa: E402
from pptx import Presentation  # noqa: E402
from pptx.dml.color import RGBColor  # noqa: E402
from pptx.enum.shapes import MSO_SHAPE  # noqa: E402
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN  # noqa: E402
from pptx.oxml.ns import qn  # noqa: E402
from pptx.util import Inches, Pt  # noqa: E402
from lxml import etree  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DIAG, SHOTS = ROOT / "assets" / "diagrams", ROOT / "screenshots"
DIAG.mkdir(parents=True, exist_ok=True)
FACTS = json.loads((ROOT / "presentation" / "facts.json").read_text())
TESTS = json.loads((ROOT / "tests" / "results.json").read_text())
NAVY, BLUE, AQUA, SOFT, AMBER, INK, GREY, PURPLE, WHITE = "0B2F4A", "0B6E99", "1FA3C4", "E4F1F7", "C75F00", "0D2B3E", "4C5A67", "59349A", "FFFFFF"
rgb = lambda h: RGBColor.from_string(h)  # noqa: E731
BIS = FACTS["profiles"]["BIS_IS10500_acceptable"]["statuses"]
BISP = FACTS["profiles"]["BIS_IS10500_permissible"]["statuses"]
UNIT, E2E = TESTS["unit"], TESTS["e2e"]


# ------------------------------------------------------------------ diagrams
def box(ax, x, y, w, h, text, fc, tc="FFFFFF", fs=9.5, ec=None, bold=True):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.1", fc="#" + fc, ec="#" + (ec or fc), lw=1.4))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color="#" + tc, fontweight="bold" if bold else "normal", linespacing=1.25)


def arrow(ax, x1, y1, x2, y2, color=GREY, ls="-"):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="-|>", color="#" + color, lw=1.6, linestyle=ls))


def canvas(w, h):
    fig, ax = plt.subplots(figsize=(w, h)); ax.set_xlim(0, w); ax.set_ylim(0, h); ax.axis("off"); return fig, ax


def make_diagrams():
    # 1 architecture
    fig, ax = canvas(11, 5.6)
    ax.add_patch(FancyBboxPatch((0.2, 0.3), 7.6, 4.9, boxstyle="round,pad=0.02,rounding_size=0.15", fc="#" + SOFT, ec="#" + BLUE, lw=2))
    ax.text(0.45, 4.95, "The user's browser  (index.html opened directly, file://)", fontsize=11, color="#" + BLUE, fontweight="bold", va="center")
    box(ax, 0.5, 3.6, 2.2, 0.8, "index.html + css\nUI shell, dialogs", NAVY)
    box(ax, 3.0, 3.6, 2.2, 0.8, "js/app.js\nUI controller", NAVY)
    box(ax, 5.5, 3.6, 2.0, 0.8, "js/data.js\nsynthetic demo rows\n+ reference config", PURPLE, fs=8.5)
    for i, t in enumerate(["validation.js\nrules, CSV parser", "analysis.js\nscreening, stats,\nrobust outliers", "charts.js\nSVG charts", "reports.js\nCSV + HTML report"]):
        box(ax, 0.5 + i * 1.8, 1.9, 1.65, 1.0, t, BLUE, fs=8.5)
    arrow(ax, 3.4, 3.6, 3.0, 2.95); arrow(ax, 4.1, 3.6, 4.5, 2.95); arrow(ax, 4.6, 3.6, 6.1, 2.95)
    box(ax, 0.5, 0.55, 3.4, 0.8, "js/storage.js  ->  localStorage\n(records, settings; demo = read-only)", AQUA, tc=INK, fs=8.5)
    box(ax, 4.2, 0.55, 3.3, 0.8, "Downloads: CSV, HTML report\nPrint dialog -> PDF", GREY, fs=8.5)
    arrow(ax, 1.3, 1.9, 1.7, 1.38); arrow(ax, 6.0, 1.9, 5.8, 1.38)
    box(ax, 8.3, 3.0, 2.5, 1.5, "NOT needed\nPython, Streamlit, Node, npm,\nbackend, database server,\nAPI keys, internet", "FFFFFF", tc=AMBER, ec=AMBER, fs=9)
    ax.text(9.55, 2.5, "config/water-quality-references.json\nis the source of truth;\nscripts/build_data.py embeds it\ninto js/data.js (dev-time only)", ha="center", va="top", fontsize=8.5, color="#" + GREY)
    fig.savefig(DIAG / "architecture.png", dpi=200, bbox_inches="tight"); plt.close(fig)

    # 2 workflow
    fig, ax = canvas(11, 4.2)
    steps = [("1  Open\nindex.html", NAVY), ("2  Demo data\nauto-loaded", PURPLE), ("3  Filter &\nexplore", BLUE), ("4  Add / edit\nor import CSV", BLUE),
             ("5  Validate", NAVY), ("6  Screen vs\nactive profile", BLUE), ("7  Explain &\nvisualise", AQUA), ("8  Export\nCSV / HTML", GREY)]
    for i, (t, c) in enumerate(steps):
        x = 0.15 + (i % 4) * 2.7; y = 2.9 if i < 4 else 0.95
        box(ax, x, y, 2.2, 1.0, t, c, tc=INK if c == AQUA else "FFFFFF", fs=10.5)
        if i % 4 < 3: arrow(ax, x + 2.2, y + 0.5, x + 2.7, y + 0.5)
    ax.plot([9.35, 9.35, 1.25], [2.9, 2.4, 2.4], color="#" + GREY, lw=1.6); arrow(ax, 1.25, 2.4, 1.25, 1.95)
    ax.text(5.4, 0.35, "Rejected rows are listed with reasons; nothing is dropped silently.   Reset Demo restores the synthetic dataset at any time.", ha="center", fontsize=9.5, color="#" + AMBER, fontweight="bold")
    fig.savefig(DIAG / "workflow.png", dpi=200, bbox_inches="tight"); plt.close(fig)

    # 3 data model
    fig, ax = canvas(11, 5.4)
    ax.add_patch(FancyBboxPatch((0.2, 0.3), 4.7, 4.8, boxstyle="round,pad=0.02", fc="#" + SOFT, ec="#" + BLUE, lw=2))
    ax.text(2.4, 4.85, "Sample record (one row)", ha="center", fontsize=11.5, color="#" + BLUE, fontweight="bold")
    fields = ["sample_id            text, unique", "sample_date          YYYY-MM-DD", "location             text  (Site A-D in demo)", "source_type          tap | borewell | well | tank | river | lake | other",
              "ph                   0-14", "turbidity_ntu        NTU", "tds_mg_l             mg/L", "temperature_c        deg C", "conductivity_us_cm   uS/cm  (optional)", "dissolved_oxygen_mg_l mg/L (optional)",
              "origin               'demo' (read-only) | 'user'", "created_at / updated_at  ISO time"]
    for i, f in enumerate(fields):
        ax.text(0.35, 4.5 - i * 0.34, f, fontsize=8.6, family="monospace", color="#" + INK)
    box(ax, 5.3, 3.7, 2.6, 1.1, "localStorage\naquaguard.v1.records\naquaguard.v1.settings", AQUA, tc=INK, fs=9)
    box(ax, 8.2, 3.7, 2.6, 1.1, "js/data.js\nDEMO_ROWS (120)\nREFERENCES, SETTINGS", PURPLE, fs=9)
    box(ax, 5.2, 1.6, 5.6, 1.6, "Reference profile (JSON)\nid -> label, standard, edition, source_url, applicability\nparameters -> { min | max, unit, criterion_type,\nverification_status, note }", BLUE, fs=8.8)
    arrow(ax, 4.9, 4.25, 5.3, 4.25); arrow(ax, 8.2, 4.25, 7.9, 4.25); arrow(ax, 9.5, 3.7, 9.5, 3.2)
    ax.text(8.0, 1.2, "Screening results are never stored: they are recomputed from\nthe active profile, so changing profile never leaves stale verdicts.", ha="center", fontsize=8.5, color="#" + GREY)
    fig.savefig(DIAG / "data_model.png", dpi=200, bbox_inches="tight"); plt.close(fig)

    # 4 csv validation flow (two columns: file-level checks, then row-level validation)
    fig, ax = canvas(11, 4.8)
    ax.text(1.9, 4.6, "File-level checks (fail = clear message)", ha="center", fontsize=9.5, color="#" + AMBER, fontweight="bold")
    left = ["Read file in the browser\n(size, empty, binary)", "Parse CSV\n(quotes, CRLF, BOM)", "Map columns + refuse\nunit-mismatch headers", "Required columns\npresent?"]
    for i, t in enumerate(left):
        y = 3.55 - i * 1.05; box(ax, 0.2, y, 3.4, 0.8, t, NAVY if i in (0, 3) else BLUE, fs=9.5)
        if i < 3: arrow(ax, 1.9, y, 1.9, y - 0.25)
    arrow(ax, 3.6, 0.55, 4.5, 2.4)
    ax.text(8.2, 4.6, "Row-level validation (every row accounted for)", ha="center", fontsize=9.5, color="#" + BLUE, fontweight="bold")
    box(ax, 4.5, 2.0, 2.2, 0.9, "Validate each row\n(ranges, dates, IDs,\nduplicates)", NAVY, fs=9.5)
    box(ax, 7.4, 3.3, 3.3, 0.9, "Valid rows\n-> preview, missing-value table", BLUE, fs=9.5)
    box(ax, 7.4, 1.0, 3.3, 0.9, "Rejected rows\nlisted with every reason", AMBER, fs=9.5)
    arrow(ax, 6.7, 2.7, 7.4, 3.6); arrow(ax, 6.7, 2.2, 7.4, 1.5)
    box(ax, 7.4, 2.15, 3.3, 0.75, "Import valid -> localStorage", AQUA, tc=INK, fs=9.5)
    arrow(ax, 9.05, 3.3, 9.05, 2.9)
    box(ax, 4.5, 0.15, 6.2, 0.55, "Download data-quality summary", GREY, fs=8.8)
    fig.savefig(DIAG / "csv_flow.png", dpi=200, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ pptx helpers
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]
SLIDES: list[dict] = []


def _bullet(p, indent=300000):
    pPr = p._p.get_or_add_pPr(); pPr.set("marL", str(indent)); pPr.set("indent", str(-indent))
    bu = etree.SubElement(pPr, qn("a:buChar")); bu.set("char", "\u2022")


def tb(s, x, y, w, h, paras, size=16, color=INK, bold=False, align=PP_ALIGN.LEFT, bullets=False, anchor=MSO_ANCHOR.TOP, font="Calibri", gap=8):
    box_ = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); tf = box_.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.04); tf.margin_top = tf.margin_bottom = Inches(0.02)
    for i, t in enumerate(paras if isinstance(paras, list) else [paras]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph(); r = p.add_run(); r.text = t
        r.font.size = Pt(size); r.font.color.rgb = rgb(color); r.font.bold = bold; r.font.name = font; p.alignment = align; p.space_after = Pt(gap)
        if bullets: _bullet(p)
    return box_


def rect(s, x, y, w, h, fill, line=None, radius=0.05, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h)); sh.fill.solid(); sh.fill.fore_color.rgb = rgb(fill)
    if line: sh.line.color.rgb = rgb(line); sh.line.width = Pt(1)
    else: sh.line.fill.background()
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE: sh.adjustments[0] = radius
    sh.shadow.inherit = False
    return sh


def card(s, x, y, w, h, head, body, fill=SOFT, hc=BLUE, size=15, hsize=17, bullets=False):
    rect(s, x, y, w, h, fill)
    tb(s, x + 0.18, y + 0.12, w - 0.36, 0.5, head, size=hsize, color=hc, bold=True)
    tb(s, x + 0.18, y + 0.62, w - 0.36, h - 0.7, body, size=size, bullets=bullets)


def pic(s, path, x, y, w=None, h=None, frame=True):
    p = s.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w) if w else None, height=Inches(h) if h else None)
    if frame: p.line.color.rgb = rgb("B8CEDB"); p.line.width = Pt(1)
    return p


def pic_fit(s, path, x, y, mw, mh):
    iw, ih = Image.open(path).size; r = min(mw / iw, mh / ih)
    return pic(s, path, x + (mw - iw * r) / 2, y + (mh - ih * r) / 2, w=iw * r, h=ih * r)


def table(s, x, y, w, rows, colw, size=12, rowh=0.36, hfill=BLUE):
    t = s.shapes.add_table(len(rows), len(rows[0]), Inches(x), Inches(y), Inches(w), Inches(rowh * len(rows))).table
    for j, cw in enumerate(colw): t.columns[j].width = Inches(cw)
    for i, row in enumerate(rows):
        t.rows[i].height = Inches(rowh)
        for j, val in enumerate(row):
            c = t.cell(i, j); c.text = str(val); c.margin_left = c.margin_right = Inches(0.06); c.margin_top = c.margin_bottom = Inches(0.025)
            c.fill.solid(); c.fill.fore_color.rgb = rgb(hfill if i == 0 else ("F4F9FB" if i % 2 else WHITE))
            for p in c.text_frame.paragraphs:
                for r in p.runs: r.font.size = Pt(size); r.font.name = "Calibri"; r.font.bold = i == 0; r.font.color.rgb = rgb(WHITE if i == 0 else INK)
    return t


def new_slide(tag, title, notes, qa=None, dark=False):
    s = prs.slides.add_slide(BLANK); n = len(prs.slides)
    s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(NAVY if dark else WHITE)
    if not dark:
        tb(s, 0.6, 0.32, 8, 0.3, tag.upper(), size=11, color=AQUA if False else BLUE, bold=True)
        tb(s, 0.6, 0.6, 12.1, 0.75, title, size=30, color=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, 0.6, 7.08, 10.5, 0.3, "AquaGuard AI  |  IBM academic project  |  UN SDG 6  |  Educational screening tool - not a safety certification. Not endorsed by IBM, the UN or any agency.", size=9, color=GREY)
        tb(s, 12.2, 7.08, 0.6, 0.3, str(n), size=10, color=GREY, align=PP_ALIGN.RIGHT)
    s.notes_slide.notes_text_frame.text = notes
    SLIDES.append({"n": n, "title": title, "notes": notes, "qa": qa or []})
    return s


def bullets(s, items, x=0.6, y=1.55, w=12.1, h=5.3, size=21, gap=14):
    return tb(s, x, y, w, h, items, size=size, bullets=True, gap=gap)


# ------------------------------------------------------------------ slides
def build():
    shot = lambda n: SHOTS / n  # noqa: E731
    n_flag, n_ins = BIS["flagged"], BIS["insufficient"]

    # 1
    s = new_slide("", "AquaGuard AI", "Welcome. AquaGuard AI is a standalone, browser-based water-quality analysis and preliminary screening application, built for an IBM academic evaluation and aligned to UN SDG 6. It opens by double-clicking index.html: no installation, no server. State up front that it never certifies water as safe and that the demo data is synthetic.",
                  [("What is it in one sentence?", "A double-click web app that validates water-quality readings, flags the ones outside a documented reference range, explains why, and exports a report, without ever claiming water is safe.")], dark=True)
    tb(s, 0.9, 1.9, 11.5, 1.3, "AquaGuard AI", size=66, color=WHITE, bold=True)
    tb(s, 0.9, 3.25, 11.5, 0.9, "Water-quality analysis and preliminary screening in a single HTML file", size=28, color="9FD8E8")
    tb(s, 0.9, 4.6, 11.5, 1.3, ["IBM academic project  |  UN SDG 6: Clean Water and Sanitation", "Sohan Manoj  |  St. Claret College, Bengaluru"], size=18, color="CADCFC")
    rect(s, 0.9, 6.1, 11.5, 0.75, "12405F")
    tb(s, 1.1, 6.18, 11.1, 0.6, "Educational screening tool. All demo data is synthetic. Not endorsed by IBM, the UN or any government agency.", size=14, color="FFD9A8", anchor=MSO_ANCHOR.MIDDLE)

    # 2
    s = new_slide("Overview", "Executive summary", "Summarise in three beats: the problem, what was built, and the evidence. The evidence is real: unit tests and browser tests were executed, and screenshots in this deck are captures of the running app. Be equally direct about what was not verified: Safari and Firefox, a live print dialog, and the reference thresholds against live sources.",
                  [("Is it finished?", "The application is complete and tested in Chromium. Other browsers and the thresholds' verification are listed as open items.")])
    for i, (h, b) in enumerate([("Problem", "People have water-quality readings but no easy way to interpret them, see trends, or decide when further testing is needed."),
                                ("Solution", "A standalone HTML app: preloaded synthetic demo, validation, transparent screening, charts, outlier detection, CSV and HTML-report export."),
                                ("Evidence", f"{UNIT['passed']} unit checks and {E2E['passed']} real-browser checks passed; no console errors; works offline from file://."),
                                ]):
        card(s, 0.6 + i * 4.15, 1.6, 3.95, 3.6, h, b, size=20, hsize=22)
    rect(s, 0.6, 5.5, 12.1, 1.25, "FFF1DC"); tb(s, 0.8, 5.58, 11.7, 1.1, ["Honest limits: screening only (never \"safe\" or \"unsafe\"); thresholds are marked UNVERIFIED until checked against the sources;", "tested in Chromium only; no field pilot has been run."], size=15, color="6B3A00", gap=3)

    # 3
    s = new_slide("Context", "Introduction to SDG 6: Clean Water and Sanitation", "SDG 6 aims to ensure availability and sustainable management of water and sanitation for all. This project touches two targets. Be precise: the app supports understanding and prioritisation of follow-up; it does not itself improve water quality.",
                  [("Does the app improve water quality?", "No. It helps people interpret measurements and decide on follow-up. Improvement needs action by water managers.")])
    card(s, 0.6, 1.6, 5.9, 2.5, "Target 6.1", "Universal and equitable access to safe and affordable drinking water. AquaGuard helps people notice readings that warrant further testing.", size=19)
    card(s, 6.8, 1.6, 5.9, 2.5, "Target 6.3", "Improve water quality by reducing pollution. Trend and location views help surface sites whose readings drift.", size=19)
    card(s, 0.6, 4.4, 12.1, 2.2, "What this project does NOT claim", "No improvement in any community's water has been achieved or measured. The tool supports interpretation and learning. Official source: https://sdgs.un.org/goals/goal6", size=18, fill="FFF1DC", hc=AMBER)

    # 4
    s = new_slide("Problem", "Problem statement", "Frame it as an interpretation gap. Instruments are cheap and common; knowing what the numbers mean is the hard part. The over-trust risk matters: three in-range numbers do not make water safe, so the tool must never imply that.",
                  [("Why not just compare numbers to a table?", "A table gives no validation, history, explanation or export, and invites over-interpretation.")])
    bullets(s, ["Readings exist (handheld meters, school labs, community monitors) but are hard to interpret.", "Users lack a clear overview of abnormal readings, trends over time, and sensible next steps.",
                "Two risks: missing a real concern, or over-trusting a few in-range numbers.", "pH, turbidity and TDS alone can never establish that water is safe to drink."], size=23)

    # 5
    s = new_slide("Evidence", "Background research and supporting evidence", "Be transparent about provenance. The build environment had no internet, so these points come from the author's knowledge of the cited documents and are marked for verification in REFERENCES.md. Do not quote a global statistic without checking the latest WHO/UNICEF JMP report.",
                  [("Why mark the sources unverified?", "Scientific honesty: they could not be checked live. The configuration has a field to record verification once done.")])
    table(s, 0.6, 1.6, 12.1, [["Source (URL in references)", "What it supports", "Status"],
                              ["UN SDG 6 (sdgs.un.org/goals/goal6)", "Goal and targets 6.1, 6.3", "Official goal page; not re-opened during build"],
                              ["WHO Guidelines for drinking-water quality, 2022 ed.", "No health-based value for pH, TDS, turbidity; operational indicators", "From author knowledge: verify"],
                              ["BIS IS 10500 (India)", "Acceptable / permissible limits for pH, turbidity, TDS", "Edition to be confirmed: verify"],
                              ["CPCB designated best use classes", "Surface-water indicators (class A)", "URL page unconfirmed: verify"],
                              ["WHO/UNICEF JMP (washdata.org)", "Global access statistics", "Re-check latest figure before quoting"]], [4.1, 5.0, 3.0], size=15, rowh=0.66)
    tb(s, 0.6, 5.6, 12.1, 1.2, "All reference thresholds in the app carry the label UNVERIFIED (entered offline). No claim of official validation is made.", size=17, color=AMBER, bold=True)

    # 6
    s = new_slide("Users", "Target users and their challenges", "Each persona wants transparency, not a black-box score: they want to know why something was flagged. That drives the explanation and provenance features.")
    for i, (h, b) in enumerate([("Students and teachers", "Need a safe, hands-on way to learn water-quality data handling."), ("NGO monitors", "Need to log samples, spot unusual sites and share a report."),
                                ("Small monitoring teams", "Need repeatable checks, trends by location and exports."), ("Evaluators", "Need visible assumptions and transparent rules they can audit.")]):
        card(s, 0.6 + i * 3.05, 1.7, 2.9, 3.9, h, b, size=19)
    tb(s, 0.6, 5.9, 12.1, 0.8, "Common challenge: not knowing whether a reading is unusual, what to do next, or how to present the data.", size=18, color=BLUE, bold=True)

    # 7
    s = new_slide("Gap", "Existing approaches and the gap", "Position AquaGuard as complementary to laboratory testing. The gap is a free, offline, transparent tool that validates data and refuses to overclaim.")
    table(s, 0.6, 1.7, 12.1, [["Approach", "Strength", "Limitation"], ["Spreadsheets", "Flexible", "No validation; silent unit and typing errors"], ["Lab reports (PDF)", "Authoritative", "Slow, per-sample, hard to trend"],
                              ["Commercial dashboards", "Polished", "Often paid and cloud-based; opaque scoring"], ["Paper logs", "Simple", "No analysis, no export"],
                              ["AquaGuard AI", "Free, offline, transparent rules, validation", "Screening only; few parameters; thresholds to be verified"]], [3.2, 4.2, 4.7], size=18, rowh=0.75)

    # 8
    s = new_slide("Solution", "Proposed solution", "Walk through the capabilities at a high level and point out that everything works from a double-click.")
    feats = [("Preloaded demo", "120 synthetic records load on first open"), ("Validated input", "Manual form and CSV; reasons for every rejection"), ("Transparent screening", "Rules against a selectable, documented profile"), ("Charts and filters", "Date, location, search and parameter filters"),
             ("Outlier detection", "Robust statistics, clearly not machine learning"), ("Reports", "HTML report, CSV exports, print to PDF")]
    for i, (h, b) in enumerate(feats):
        r, c = divmod(i, 3); card(s, 0.6 + c * 4.1, 1.7 + r * 2.5, 3.9, 2.3, h, b, size=19)

    # 9
    s = new_slide("Goals", "Project objectives", "Be honest about status: five objectives are verified by automated tests; the real-world value objective has not been measured and needs a pilot.")
    table(s, 0.6, 1.6, 12.1, [["Objective", "Measure", "Status"], ["Opens by double-click, no installs", "Browser test via file://", "Verified (Chromium)"], ["Correct validation with clear errors", "Unit + browser tests", "Verified"],
                              ["Transparent screening, never safe/unsafe", "Wording tests; no safe badge", "Verified"], ["Dashboard figures from actual records", "KPIs cross-checked independently", "Verified"],
                              ["Works offline", "Zero network requests recorded", "Verified"], ["Real-world value for users", "Needs a user pilot", "NOT measured"]], [5.0, 4.4, 2.7], size=18, rowh=0.68)

    # 10
    s = new_slide("Design", "System architecture", "Everything runs in the browser. Plain scripts, not ES modules, so file:// works. The reference configuration lives in JSON and is embedded into data.js at build time by a small dev-only script, so the app can read it without a server.",
                  [("Why no backend?", "Privacy and simplicity: no data leaves the machine and nothing needs installing.")])
    pic_fit(s, DIAG / "architecture.png", 0.9, 1.45, 11.5, 5.5)

    # 11
    s = new_slide("Design", "Technology stack and rationale", "Vanilla technologies keep the app dependency-free and file://-friendly. Chart.js could not be downloaded in the build environment, so a small SVG chart library was written; the same functions render on-screen charts and charts embedded in the HTML report.",
                  [("Why not Chart.js?", "No internet when built; a local copy was unavailable. A 250-line SVG library covers the five chart types needed, works offline and also feeds the report.")])
    table(s, 0.6, 1.6, 12.1, [["Choice", "Why"], ["HTML5 + CSS3 + vanilla JavaScript", "Runs by double-click; no build step, no frameworks"], ["Plain <script> files (no ES modules)", "Modules are blocked on file:// in some browsers"],
                              ["Custom SVG charts (js/charts.js)", "Offline; also used inside exported reports; accessible titles"], ["localStorage", "Persistence without a server; per-browser and private"],
                              ["Embedded data.js", "fetch() of local JSON is blocked on file://; data.js loads as a normal script"], ["Node / Playwright (dev only)", "Test runner and screenshots; NOT needed by users"]], [4.6, 7.5], size=17, rowh=0.72)

    # 12
    s = new_slide("Design", "Application folder structure", "Each module has one job. Users only need index.html and its folders; scripts, tests and presentation are for developers.")
    tree = ("AquaGuard-AI/\n|-- index.html              <- double-click this\n|-- css/styles.css\n|-- js/\n|   |-- app.js              UI controller\n|   |-- data.js             demo rows + references (generated)\n|   |-- validation.js       rules + CSV parser\n|   |-- analysis.js         screening, stats, outliers\n|   |-- charts.js           SVG charts\n|   |-- storage.js          localStorage\n|   `-- reports.js          CSV + HTML report\n|-- data/demo-water-quality.csv\n|-- config/water-quality-references.json\n|-- assets/ (logo, diagrams)   screenshots/\n|-- tests/ (unit + browser)   scripts/ (dev tools)\n|-- presentation/ (this deck + source)\n`-- README.md, PROJECT_REPORT.md, ... LICENSE")
    rect(s, 0.6, 1.55, 7.6, 5.3, "F4F9FB", line="B8CEDB"); tb(s, 0.8, 1.65, 7.3, 5.1, tree.split("\n"), size=14, font="Consolas", gap=2)
    card(s, 8.5, 1.55, 4.2, 5.3, "What users need", ["index.html", "css/ and js/", "data/ and config/ (reference copies)", "", "Everything else is documentation and developer tooling."], size=16, bullets=False)

    # 13
    s = new_slide("Data", "Data model and sample dataset", f"One flat record type. The demo dataset is synthetic: {FACTS['total']} records, four fictional sites, {FACTS['firstDate']} to {FACTS['lastDate']}, with ordinary values, missing measurements, exceedances and deliberate anomalies. It is generated by a script with a fixed seed.",
                  [("Is the demo data real?", "No. It is fictional, generated by scripts/build_data.py with a fixed random seed, and labelled as synthetic everywhere in the app and reports.")])
    pic_fit(s, DIAG / "data_model.png", 0.5, 1.5, 7.9, 5.4)
    miss = {m["label"]: m for m in FACTS["missing"]}
    card(s, 8.7, 1.55, 4.0, 5.3, "Demo dataset (synthetic)", [f"{FACTS['total']} records, 4 fictional sites (Site A-D)", f"{FACTS['firstDate']} to {FACTS['lastDate']}", f"{n_flag} flagged, {n_ins} insufficient (BIS acceptable)",
                                                               f"{FACTS['outliers']} statistically unusual samples", f"Missing: conductivity {miss['Electrical conductivity']['pct']}%, dissolved oxygen {miss['Dissolved oxygen']['pct']}%"], size=15, bullets=True)

    # 14
    s = new_slide("Design", "Application workflow: from input to result", "Tell the story of one record. It arrives through the form or a CSV, passes validation, is stored, is screened against the active profile, and then appears in charts, tables, explanations and exports. Reset Demo restores the original dataset at any time.")
    pic_fit(s, DIAG / "workflow.png", 0.9, 1.6, 11.5, 4.4)
    tb(s, 0.9, 6.15, 11.5, 0.7, "Every figure and chart is recalculated from the stored records and the active filters.", size=17, color=BLUE, bold=True, align=PP_ALIGN.CENTER)

    # 15
    s = new_slide("Science", "Water-quality parameters explained", "Explain each parameter simply, and say what it can and cannot tell you. Accepted input ranges are plausibility limits for data entry, not water-quality thresholds.")
    table(s, 0.6, 1.55, 12.1, [["Parameter", "Unit", "In plain words", "Input range"], ["pH", "pH units", "How acidic or alkaline the water is", "0 to 14"], ["Turbidity", "NTU", "How cloudy the water is (suspended particles)", "0 to 1000"],
                               ["TDS", "mg/L", "Dissolved minerals and salts (taste/acceptability)", "0 to 50000"], ["Temperature", "deg C", "Water temperature at sampling", "0 to 60"],
                               ["Conductivity (optional)", "uS/cm", "How well water conducts current; tracks dissolved ions", "0 to 100000"], ["Dissolved oxygen (optional)", "mg/L", "Oxygen available to aquatic life (surface water)", "0 to 25"]], [3.2, 1.5, 5.6, 1.8], size=17, rowh=0.64)
    tb(s, 0.6, 6.0, 12.1, 0.9, "None of these detects bacteria, viruses, arsenic, nitrate, pesticides or heavy metals.", size=18, color=AMBER, bold=True)

    # 16
    s = new_slide("Science", "Reference thresholds and scientific limitations", "Four profiles are configurable. Each threshold records standard, edition, unit, applicability, criterion type and source URL. They are all marked unverified. Distinguish drinking-water, operational and surface-water indicators.",
                  [("Is this BIS compliance?", "No. It screens three parameters against one column of the standard. Compliance needs the full standard and laboratory data.")])
    table(s, 0.6, 1.55, 7.6, [["Profile", "pH", "Turbidity", "TDS"], ["BIS acceptable", "6.5-8.5", "<= 1 NTU", "<= 500 mg/L"], ["BIS permissible", "6.5-8.5", "<= 5 NTU", "<= 2000 mg/L"], ["WHO operational", "6.5-8.5", "<= 1 NTU", "<= 600 mg/L"], ["CPCB class A (surface)", "6.5-8.5", "(DO >= 6 mg/L)", "<= 500 mg/L"]], [2.8, 1.4, 1.7, 1.7], size=16, rowh=0.6)
    tb(s, 0.6, 4.5, 7.6, 2.4, ["All values: UNVERIFIED (entered offline).", "Criterion types: health-based, aesthetic/operational, environmental indicator.", "Limits are inclusive; the active profile is always visible."], size=17, bullets=True)
    card(s, 8.5, 1.55, 4.2, 5.3, "Scientific limitations", ["Screening cannot establish potability", "Microbial and toxic hazards are invisible", "Sampling and instrument errors are not detected", "Thresholds depend on use and jurisdiction"], size=17, fill="FFF1DC", hc=AMBER, bullets=True)

    # 17
    s = new_slide("Method", "Screening algorithm, step by step", "Walk the five steps. Stress that the same function screens manual and imported records (a test proves it), that limits are inclusive, and that the wording is fixed so the tool cannot say 'safe'.",
                  [("What if one value is out of range?", "The sample is flagged for review, not declared unsafe; the explanation says whether the criterion is aesthetic/operational or an environmental indicator.")])
    steps = [("1 Validate", "Bad or incomplete data -> Invalid record"), ("2 Select", "Use parameters in the active profile that the sample has"), ("3 Compare", "Inclusive limits: a value on the limit is within range"), ("4 Count", "Fewer than 2 profile parameters -> Insufficient data"), ("5 Explain", "Value, unit, range, source, status, reason, next step")]
    for i, (h, b) in enumerate(steps):
        x = 0.6 + i * 2.45; card(s, x, 1.8, 2.25, 2.7, h, b, size=16, hsize=17)
        if i < 4: tb(s, x + 2.22, 2.8, 0.3, 0.5, "\u25B6", size=14, color=BLUE)
    rect(s, 0.6, 4.9, 12.1, 1.8, SOFT); tb(s, 0.8, 5.0, 11.7, 1.7, ["Four outcomes: Within configured range | Flagged for review | Insufficient data | Invalid record.", "Fixed wording: \"No configured threshold exceedances detected\" and \"This result does not establish drinking-water safety.\"", "There is no green \"safe to drink\" badge anywhere in the app."], size=16, bullets=True, gap=5)

    # 18
    s = new_slide("Product", "Dashboard and application screenshots", "These are real screenshots captured from the running application opened from file:// in headless Chromium during the automated test run. The dashboard shows figures computed from the loaded records. The demo-mode label is always visible.")
    pic_fit(s, shot("01-dashboard.png"), 0.6, 1.5, 7.9, 5.3)
    pic_fit(s, shot("02-samples.png"), 8.7, 1.5, 4.1, 2.55); pic_fit(s, shot("05-screening.png"), 8.7, 4.2, 4.1, 2.55)
    tb(s, 0.6, 6.82, 12.1, 0.25, "Real screenshots of the running app (Chromium, file://). Synthetic demo data.", size=10, color=GREY)

    # 19
    s = new_slide("Product", "CSV upload and validation workflow", "Explain each safeguard. Fatal problems stop the import with a clear message; row-level problems are listed with reasons and never silently dropped; units are never converted. The demo data keeps working whatever happens to an upload.")
    pic_fit(s, DIAG / "csv_flow.png", 0.5, 1.45, 6.2, 3.4); pic_fit(s, shot("04-csv-validation.png"), 6.9, 1.5, 5.9, 5.3)
    tb(s, 0.6, 5.0, 6.1, 1.9, ["Rejected rows are listed with every reason.", "Headers like tds_ppm or temperature_f are refused, not converted.", "Template download; data-quality summary download."], size=15, bullets=True, gap=5)

    # 20
    s = new_slide("Analytics", "Analytics and outlier detection", f"Charts update with the filters. Outlier detection uses a robust z-score from the median and MAD; the demo data yields {FACTS['outliers']} unusual samples at the default threshold. It is deliberately called a statistical outlier detector, not AI or machine learning, and an unusual value is not necessarily contaminated.",
                  [("Why not machine learning?", "No labelled data exists and a transparent statistic is easier to explain and audit. No accuracy is claimed.")])
    pic_fit(s, shot("06-analytics.png"), 0.6, 1.5, 6.3, 5.3)
    card(s, 7.1, 1.55, 5.6, 5.3, "Robust z-score (not ML)", ["z = 0.6745 x (value - median) / MAD", "Flag when |z| >= 3.5 (adjustable), optionally within each location", "Median/MAD are not distorted by the outliers they seek", f"Demo data: {FACTS['outliers']} unusual samples across all sites", "Unusual does not mean contaminated or unsafe", "Charts: distribution, trend, location box plot, status by site, missing data"], size=15, bullets=True)

    # 21
    s = new_slide("Output", "Reporting and export", "Reports are generated in the browser from exactly the filtered records and the active profile. PDF is produced via the browser's print dialog because no PDF library could be bundled locally. The print dialog itself cannot be verified headlessly.")
    pic_fit(s, shot("08-reports.png"), 0.6, 1.5, 6.5, 5.3)
    card(s, 7.3, 1.55, 5.4, 5.3, "Exports", ["HTML report: sample details, profile, data quality, units, flags, charts, limitations, disclaimer", "Print / save as PDF via the browser", "CSV: filtered records, screening results, flagged observations", "Data-quality summary (text)", "Text cells are formula-injection safe"], size=15, bullets=True)

    # 22
    s = new_slide("Quality", "Testing strategy and actual results", f"All numbers come from tests/results.json written by the test runners. Unit tests ({UNIT['total']} checks) run the logic modules in Node; the browser suite ({E2E['total']} checks) drives index.html via file:// in headless Chromium. Not verified: Safari, Firefox, the live print dialog, real mobile devices, accessibility audit with a screen reader, and thresholds against live sources.",
                  [("Can I trust the tests?", "They execute the real code and the real UI. They run in Chromium only; other browsers are untested and listed as such.")])
    for i, (num, lab) in enumerate([(UNIT["passed"], "unit checks passed\n(validation, screening, storage, reports)"), (E2E["passed"], "browser checks passed\n(real Chromium, file://)"), (0, "failures and 0 console errors\nduring the browser session")]):
        rect(s, 0.6 + i * 4.1, 1.55, 3.9, 2.3, SOFT); tb(s, 0.6 + i * 4.1, 1.6, 3.9, 1.2, str(num), size=60, color=BLUE, bold=True, align=PP_ALIGN.CENTER); tb(s, 0.6 + i * 4.1, 2.8, 3.9, 0.9, lab.split("\n"), size=14, align=PP_ALIGN.CENTER, gap=1)
    card(s, 0.6, 4.1, 6.0, 2.75, "Verified", ["Add / edit / delete, persistence, reset", "CSV valid, messy, empty, unit, binary files", "Filters, search, sorting, charts, outliers", "Reports and exports; offline (0 requests)", "Mobile layout at 390 px; keyboard and labels"], size=15, bullets=True)
    card(s, 6.8, 4.1, 5.9, 2.75, "NOT verified", ["Safari and Firefox", "Live print dialog / PDF output", "Real phones; screen-reader audit", "Thresholds against live standards", "Any real-world pilot"], size=15, fill="FFF1DC", hc=AMBER, bullets=True)

    # 23
    s = new_slide("Value", "Advantages, disadvantages and practical use cases", "Give a balanced view. The advantages are real but small in scope; the disadvantages are important for an honest evaluation.")
    card(s, 0.6, 1.55, 4.0, 3.5, "Advantages", ["Opens by double-click", "Private: no data leaves the browser", "Validation before analysis", "Transparent, auditable rules"], size=17, bullets=True)
    card(s, 4.8, 1.55, 4.0, 3.5, "Disadvantages", ["Six parameters only", "Browser-local storage (per browser)", "Thresholds unverified", "No sharing or multi-user mode"], size=17, fill="FFF1DC", hc=AMBER, bullets=True)
    card(s, 9.0, 1.55, 3.7, 3.5, "Use cases", ["Teaching data literacy", "Community monitoring logs", "Preparing a lab-test request", "Demonstrating screening logic"], size=17, bullets=True)
    rect(s, 0.6, 5.3, 12.1, 1.5, SOFT); tb(s, 0.8, 5.4, 11.7, 1.3, "Compared with manual interpretation: consistent rules, early data-quality checks, trends and exports. Not compared: accuracy of conclusions, because none was measured.", size=19, color=INK)

    # 24
    s = new_slide("Responsibility", "Privacy, security, ethics and limitations", "Cover each quadrant. The key ethical point is that the app must not be mistaken for a safety certificate, so it uses fixed wording, prominent disclaimers and no green badge.")
    for i, (h, b) in enumerate([("Privacy", "No accounts, no personal data, no network calls; data stays in this browser's localStorage."), ("Security", "Files parsed as text only; size limits; all output HTML-escaped; CSV formula injection neutralised."),
                                ("Ethics", "Never labels water safe/unsafe; synthetic data always labelled; no endorsement claimed."), ("Limitations", "Few parameters; no microbiology or toxic chemicals; unverified thresholds; tested in Chromium only.")]):
        r, c = divmod(i, 2); card(s, 0.6 + c * 6.2, 1.55 + r * 2.7, 5.9, 2.5, h, b, size=19, fill="FFF1DC" if h == "Limitations" else SOFT, hc=AMBER if h == "Limitations" else BLUE)

    # 25
    s = new_slide("Future", "SDG impact pathway and future scope", "The pathway is a hypothesis, not a result. Make clear that no pilot has been run and none is claimed. Future work starts with verifying thresholds and testing in more browsers.",
                  [("What impact numbers do you have?", "None. We claim verified software behaviour only. Impact needs a consented pilot with expert review of thresholds.")])
    for i, (h, b) in enumerate([("Clearer interpretation", "Readings are validated and explained"), ("Better follow-up", "Users know when lab testing is warranted"), ("Earlier attention", "Drifting sites are noticed sooner"), ("Possible SDG 6 benefit", "Requires action by water managers; not claimed")]):
        card(s, 0.6 + i * 3.05, 1.6, 2.9, 2.2, h, b, size=16, hsize=17)
        if i < 3: tb(s, 0.6 + i * 3.05 + 2.88, 2.5, 0.3, 0.4, "\u25B6", size=12, color=BLUE)
    card(s, 0.6, 4.1, 6.0, 2.75, "Realistic next steps", ["Verify every threshold against the sources", "Test in Safari and Firefox; accessibility audit", "Add parameters with documented criteria", "Bundled PDF export"], size=16, bullets=True)
    card(s, 6.8, 4.1, 5.9, 2.75, "Evaluation plan (not yet done)", ["Pilot with 2-3 school/community monitors, with consent", "Measure time to interpret, errors caught, comprehension", "Compare with a spreadsheet baseline"], size=16, bullets=True)

    # 26
    s = new_slide("Wrap-up", "Conclusion and references", "Close by restating the contribution and the honest limits. All reference URLs were not re-opened during the build because the environment had no internet: verify them before presenting.")
    card(s, 0.6, 1.55, 5.2, 5.3, "Conclusion", ["AquaGuard AI is a working, tested, double-click web app for transparent water-quality screening.", "It validates data, explains flags and refuses to overclaim.", "Its value for real users still has to be evaluated."], size=19, bullets=True)
    tb(s, 6.1, 1.55, 6.6, 5.4, ["References (URLs not re-opened during build; verify):", "UN SDG 6: https://sdgs.un.org/goals/goal6", "WHO Guidelines for drinking-water quality, 4th ed. + addenda (2022): https://www.who.int/publications/i/item/9789240045064",
                                  "WHO/UNICEF JMP: https://washdata.org", "BIS IS 10500: https://www.bis.gov.in", "CPCB: https://cpcb.nic.in", "UN-Water SDG 6 Synthesis Report 2018: https://www.unwater.org/publications/highlights-sdg-6-synthesis-report-2018-water-and-sanitation"], size=14, bullets=False, gap=7)


def write_notes():
    out = ["# Presenter Notes", "", "Generated by `presentation/presentation_source.py` from the same source as the deck (so notes and slides always match). Suggested pace: about 1.5 minutes per slide.", ""]
    for i, sd in enumerate(SLIDES):
        out += [f"## Slide {sd['n']}: {sd['title']}", "", sd["notes"], ""]
        if i + 1 < len(SLIDES): out += [f"*Transition:* \"Next: {SLIDES[i + 1]['title'].lower()}.\"", ""]
        for q, a in sd["qa"]: out += [f"**Likely question:** {q}", "", f"**Suggested answer:** {a}", ""]
    out += ["## Extra evaluator questions", "",
            "**Does it say whether water is safe?** No, by design. It reports configured-range screening only and states that pH, turbidity and TDS cannot establish safety.", "",
            "**Where does the data come from?** The demo data is synthetic. Users bring their own measurements; nothing is uploaded anywhere.", "",
            "**Why a single HTML file instead of Python/Streamlit?** The first version needed Python and package installation; this one opens by double-click and is easier to review and share.", "",
            "**What did you not verify?** Safari/Firefox, the live print dialog, thresholds against live sources, real-world value. See TESTING.md.", "",
            "**Is the outlier detector AI?** No. It is a robust z-score (median and MAD). We do not claim machine learning or accuracy.", "",
            "**What happens to my data?** It stays in your browser's localStorage. Reset Demo restores only the synthetic records; no files on your computer are touched.", ""]
    (ROOT / "PRESENTER_NOTES.md").write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    make_diagrams()
    build()
    target = ROOT / "presentation" / "AquaGuard_AI_IBM_SDG6_Presentation_Final.pptx"
    prs.save(target); write_notes()
    print(f"saved {target.name}: {len(prs.slides)} slides")
