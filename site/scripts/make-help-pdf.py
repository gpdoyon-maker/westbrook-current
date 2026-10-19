#!/usr/bin/env python3
"""
Makes the printable Westbrook Currents Help Guide (PDF) from the Get Help data files.

  python3 site/scripts/make-help-pdf.py            # writes site/public/westbrook-currents-help-guide.pdf
  python3 site/scripts/make-help-pdf.py --date 2026-10-16

The words, phone numbers, links and "Last checked" dates all come from
site/src/data/help-*.json, the same files the website pages use. Run this again
whenever one of those files changes, then commit the new PDF with it.

Needs Python 3 with the reportlab and Pillow packages. It is not part of the website build.
"""
import argparse, datetime, json, os, re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, KeepTogether, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
DATA = os.path.join(SITE, 'src', 'data')
OUT = os.path.join(SITE, 'public', 'westbrook-currents-help-guide.pdf')
LOGO = os.path.join(SITE, 'public', 'logo-desktop.png')
SITE_URL = 'https://westbrookcurrents.com'

# ---- Fonts and colors ------------------------------------------------------
# The Linux system path (present on CI and most Linux machines, e.g. via the
# fonts-liberation package). Falls back to the copy checked into this repo
# (same font, from the official Debian fonts-liberation2 package) so the
# script also runs on a Mac or anywhere else without that system package.
_SYSTEM_FONT_DIR = '/usr/share/fonts/truetype/liberation'
FONT_DIR = _SYSTEM_FONT_DIR if os.path.isdir(_SYSTEM_FONT_DIR) else os.path.join(HERE, 'fonts')
pdfmetrics.registerFont(TTFont('Sans', f'{FONT_DIR}/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Bold', f'{FONT_DIR}/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Italic', f'{FONT_DIR}/LiberationSans-Italic.ttf'))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans-Italic', boldItalic='Sans-Bold')

NAVY = colors.HexColor('#0d2b45')
BLUE = colors.HexColor('#087ca7')
INK = colors.HexColor('#1f3a4d')
MUTED = colors.HexColor('#4a6070')
LINE = colors.HexColor('#cfd9e1')
RED = colors.HexColor('#8c1a12')
RED_TINT = colors.HexColor('#fdecea')
TOPICS = {
    'heating': dict(accent=colors.HexColor('#b4430c'), tint=colors.HexColor('#fff1e4'), edge=colors.HexColor('#f2c9a6')),
    'electricity': dict(accent=colors.HexColor('#8a6100'), tint=colors.HexColor('#fff7d6'), edge=colors.HexColor('#ecd98a')),
    'food': dict(accent=colors.HexColor('#1f7a3d'), tint=colors.HexColor('#e8f6ec'), edge=colors.HexColor('#b4dcc0')),
}

def style(name, **kw):
    base = dict(fontName='Sans', fontSize=11.5, leading=16, textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

S = {
    'body': style('body'),
    'small': style('small', fontSize=10, leading=13.5, textColor=MUTED),
    'know': style('know', fontSize=10.5, leading=14.5, textColor=MUTED),
    'h1': style('h1', fontName='Sans-Bold', fontSize=26, leading=30, textColor=NAVY),
    'h2': style('h2', fontName='Sans-Bold', fontSize=16, leading=20, textColor=NAVY, spaceBefore=6, spaceAfter=4),
    'h3': style('h3', fontName='Sans-Bold', fontSize=13.5, leading=17, textColor=NAVY),
    'tag': style('tag', fontName='Sans-Bold', fontSize=8.5, leading=11, textColor=BLUE),
    'chip': style('chip', fontName='Sans-Bold', fontSize=9.5, leading=12, textColor=colors.HexColor('#5b3a00')),
    'link': style('link', fontSize=10, leading=13.5, textColor=BLUE),
    'step': style('step', fontName='Sans-Bold', fontSize=14, leading=17, textColor=NAVY),
    'stepsub': style('stepsub', fontSize=10.5, leading=13, textColor=MUTED),
    'urgent': style('urgent', fontSize=11.5, leading=16, textColor=colors.HexColor('#5c1511')),
    'cover_sub': style('cover_sub', fontSize=14, leading=19, textColor=INK),
}

def p(text, st='body'):
    return Paragraph(escape(text), S[st])

def pm(markup, st='body'):
    """Paragraph with simple markup already built (escape inside it yourself)."""
    return Paragraph(markup, S[st])

def pretty_date(iso):
    y, m, d = [int(x) for x in iso.split('-')]
    return datetime.date(y, m, d).strftime('%b ') + str(d) + f', {y}'

def link(url, label=None):
    return f'<a href="{escape(url)}" color="#087ca7"><u>{escape(label or url)}</u></a>'

def short_url(url):
    return re.sub(r'^https?://(www\.)?', '', url).rstrip('/')

def load(name):
    with open(os.path.join(DATA, f'help-{name}.json'), encoding='utf-8') as f:
        return json.load(f)

# ---- Small flowables --------------------------------------------------------
class CheckBox(Flowable):
    def __init__(self, size=11):
        super().__init__(); self.size = size; self.width = size; self.height = size
    def draw(self):
        self.canv.setStrokeColor(BLUE); self.canv.setLineWidth(1.6)
        self.canv.roundRect(0, 0, self.size, self.size, 2, stroke=1, fill=0)

class StepBadge(Flowable):
    def __init__(self, n, color, last=False, size=34):
        super().__init__(); self.n = n; self.color = color; self.last = last; self.size = size
        self.width = size; self.height = size
    def draw(self):
        c = self.canv; r = self.size / 2
        if self.last:
            c.setStrokeColor(self.color); c.setLineWidth(2.2); c.setFillColor(colors.white)
            c.circle(r, r, r - 1.5, stroke=1, fill=1); c.setFillColor(self.color)
        else:
            c.setFillColor(self.color); c.circle(r, r, r, stroke=0, fill=1); c.setFillColor(colors.white)
        c.setFont('Sans-Bold', 6.5); c.drawCentredString(r, r + 6, 'STEP')
        c.setFont('Sans-Bold', 15); c.drawCentredString(r, r - 8, str(self.n))

def box(flowables, bg, border, pad=10, width=None, bw=1.2):
    t = Table([[flowables]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg), ('BOX', (0, 0), (-1, -1), bw, border),
        ('LEFTPADDING', (0, 0), (-1, -1), pad + 2), ('RIGHTPADDING', (0, 0), (-1, -1), pad + 2),
        ('TOPPADDING', (0, 0), (-1, -1), pad), ('BOTTOMPADDING', (0, 0), (-1, -1), pad)]))
    return t

W = letter[0] - 1.4 * inch   # text width

# ---- Building blocks --------------------------------------------------------
def topic_banner(title, subtitle, t):
    cell = [Paragraph(f'<font color="white">{escape(title)}</font>', style('bn', fontName='Sans-Bold', fontSize=22, leading=26)),
            Paragraph(f'<font color="white">{escape(subtitle)}</font>', style('bs', fontSize=11.5, leading=15))]
    tb = Table([[cell]], colWidths=[W])
    tb.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), t['accent']), ('LEFTPADDING', (0, 0), (-1, -1), 16),
                            ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12)]))
    return tb

def urgent_box(lines):
    return box(lines, RED_TINT, RED, width=W, bw=1.6)

def checklist(title, items, note, t):
    rows = [[CheckBox(), p(item)] for item in items]
    tbl = Table(rows, colWidths=[22, W - 60])
    tbl.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 3),
                             ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (0, -1), 0),
                             ('TOPPADDING', (0, 0), (0, -1), 5)]))
    return box([p(title, 'h2'), tbl, Spacer(1, 4), p(note, 'small')], colors.white, LINE, width=W)

def program_card(prog, checked, t):
    inner = [p(prog['tag'].upper(), 'tag'), p(prog['name'], 'h3')]
    if prog.get('chip'):
        inner += [Spacer(1, 3), pm(f'<b>[ {escape(prog["chip"])} ]</b>', 'chip')]
    inner += [Spacer(1, 4), p(prog['summary'])]
    if prog.get('know'):
        inner += [Spacer(1, 3), p(prog['know'], 'know')]
    lines = []
    if prog.get('phone') and prog.get('phoneHref'):
        lines.append(f'<b>Call: {escape(prog["phone"])}</b>')
    if prog.get('more'):
        lines.append(f'{escape(prog["more"]["label"])}: {link(SITE_URL + prog["more"]["url"], short_url(SITE_URL + prog["more"]["url"]))}')
    lines.append(f'Official page: {link(prog["sourceUrl"], short_url(prog["sourceUrl"]))}')
    inner += [Spacer(1, 5)] + [pm(x, 'body') for x in lines]
    inner += [Spacer(1, 4), p(f'Source: {prog["sourceLabel"]}. Last checked {pretty_date(checked)}.', 'small')]
    tb = Table([[inner]], colWidths=[W - 18])
    tb.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, LINE), ('LINEBEFORE', (0, 0), (0, -1), 5, t['accent']),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]))
    return tb

def step_head(step, t):
    count = len(step['programs'])
    txt = [p(step['title'], 'step'), p(f'{step["sub"]}  |  {count} {"program" if count == 1 else "programs"}', 'stepsub')]
    tb = Table([[StepBadge(step['n'], t['accent'], bool(step.get('last'))), txt]], colWidths=[46, W - 64])
    tb.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    return tb

def topic_section(slug, subtitle, intro_note=None):
    d = load(slug); t = TOPICS[slug]
    programs = {x['id']: x for x in d['programs']}
    out = [topic_banner(d['title'], subtitle, t), Spacer(1, 8), p(d['intro']), Spacer(1, 8)]

    em = d['emergency']
    if slug == 'heating':
        lines = [p(em['lowFuelTitle'], 'step'), p(em['lowFuelText']), pm(f'<b><font size="15">{escape(em["phone"])}</font></b>'),
                 Spacer(1, 5), p(em['dangerTitle'], 'step'), p(em['dangerText'])]
    elif slug == 'electricity':
        lines = [p(em['title'], 'step'), p(em['text']), pm(f'<b><font size="15">{escape(em["phone"])}</font></b>'), Spacer(1, 3),
                 p(em['text2']), pm(f'<b><font size="15">{escape(em["phone2"])}</font></b>  ({escape(em["hours2"])})'),
                 Spacer(1, 5), p(em['dangerTitle'], 'step'), p(em['dangerText'])]
    else:
        lines = [p(em['title'], 'step'), p(em['text']), Spacer(1, 5), p(em['dangerTitle'], 'step'), p(em['dangerText'])]
    out += [urgent_box(lines), Spacer(1, 10)]

    if slug == 'heating':
        inc = d['income']
        rows = [['People in home', 'Per month', 'Per year']] + [[str(r['people']), r['month'], r['year']] for r in inc['rows']]
        tbl = Table(rows, colWidths=[(W - 40) * .4, (W - 40) * .3, (W - 40) * .3])
        tbl.setStyle(TableStyle([('FONTNAME', (0, 0), (-1, 0), 'Sans-Bold'), ('FONTNAME', (0, 1), (-1, -1), 'Sans-Bold'),
                                 ('FONTSIZE', (0, 0), (-1, 0), 9.5), ('FONTSIZE', (0, 1), (-1, -1), 12),
                                 ('TEXTCOLOR', (0, 0), (-1, 0), MUTED), ('TEXTCOLOR', (0, 1), (-1, -1), NAVY),
                                 ('ALIGN', (1, 0), (-1, -1), 'RIGHT'), ('LINEBELOW', (0, 0), (-1, 0), 1.2, LINE),
                                 ('LINEBELOW', (0, 1), (-1, -1), .6, t['edge']),
                                 ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
        src = f'Season {inc["season"]}. {inc["fine"]}'
        out += [box([p(inc['title'], 'h2'), p(inc['text']), Spacer(1, 4), tbl, Spacer(1, 4), p(src, 'small'),
                     pm(f'Source: {link(inc["sourceUrl"], inc["sourceLabel"])}. Last checked {pretty_date(d["lastChecked"])}.', 'small')],
                    t['tint'], t['edge'], width=W), Spacer(1, 10)]
    else:
        who = d['who']
        extra = [p(who['fine'], 'small')]
        if who.get('linkUrl'):
            extra = [pm(f'{escape(who["fine"])} {link(who["linkUrl"] if who["linkUrl"].startswith("http") else SITE_URL + who["linkUrl"], who["linkLabel"])}.', 'small')]
        out += [box([p(who['title'], 'h2'), p(who['text']), Spacer(1, 4)] + extra +
                    [p(f'Last checked {pretty_date(d["lastChecked"])}.', 'small')], t['tint'], t['edge'], width=W), Spacer(1, 10)]

    if d.get('checklist'):
        ck = d['checklist']
        out += [checklist(ck['title'], ck['items'], ck['note'], t), Spacer(1, 10)]
    if d.get('agency'):
        out += [program_card(programs[d['agency']], d['lastChecked'], t), Spacer(1, 12)]

    out += [p('Follow these steps', 'h2'), Spacer(1, 2)]
    for step in d['steps']:
        block = [step_head(step, t), Spacer(1, 6)]
        for i, pid in enumerate(step['programs']):
            card = program_card(programs[pid], d['lastChecked'], t)
            if i == 0:
                out.append(KeepTogether(block + [card]))
            else:
                out.append(card)
            out.append(Spacer(1, 8))
        out.append(Spacer(1, 6))
    return out

def qr_block(made_on, path='/help'):
    qr = QrCodeWidget(SITE_URL + path)
    b = qr.getBounds(); size = 92
    dr = Drawing(size, size, transform=[size / (b[2] - b[0]), 0, 0, size / (b[3] - b[1]), 0, 0]); dr.add(qr)
    qr_row = Table([[dr, [p('The newest version is always on the website.', 'h3'), Spacer(1, 3),
                          pm(f'Scan the code, or visit {link(SITE_URL + path, "westbrookcurrents.com" + path)}. '
                             'Phone numbers, rules and dates can change, so check the website before you go.'),
                          Spacer(1, 3), p(f'This guide was made on {pretty_date(made_on)}. Each program shows the date we last checked it.', 'small')]]],
                   colWidths=[108, W - 108])
    qr_row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    return qr_row

# ---- Cover page ---------------------------------------------------------------
def cover(made_on, topics):
    items = []
    from PIL import Image
    w, h = Image.open(LOGO).size
    lw = W - 36; lh = lw * h / w
    from reportlab.platypus import Image as RLImage
    head = Table([[RLImage(LOGO, width=lw, height=lh)]], colWidths=[W])
    head.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), NAVY), ('LEFTPADDING', (0, 0), (-1, -1), 18),
                              ('TOPPADDING', (0, 0), (-1, -1), 16), ('BOTTOMPADDING', (0, 0), (-1, -1), 16)]))
    items += [head, Spacer(1, 22), p('Westbrook Help Guide', 'h1'), Spacer(1, 6),
              p('Help with heat, electricity and food for people who live in Westbrook, Maine.', 'cover_sub'), Spacer(1, 14)]

    emerg = [p('Need help right now?', 'step'),
             pm('<b>Life-threatening emergency:</b> call <b>911</b>.'),
             pm('<b>Help finding food, fuel or other help any time:</b> dial <b>211</b>, or text your ZIP code to <b>898-211</b>.')]
    items += [urgent_box(emerg), Spacer(1, 14)]

    items += [p('How to use this guide', 'h2'),
              p('Each section has the same parts: urgent numbers first, then who may qualify, then what to get ready, then the steps in order. '
                'Start with Step 1 and keep going only if you need more help.'),
              Spacer(1, 4),
              p('Call first. Most offices want you to phone before you visit, and many do not take walk-ins.'), Spacer(1, 12)]

    rows = [[p('Inside this guide', 'h2'), '']] + [[pm(f'<b>{escape(name)}</b>'), p(desc, 'small')] for name, desc in topics]
    tb = Table(rows, colWidths=[W * .32, W * .68])
    tb.setStyle(TableStyle([('SPAN', (0, 0), (1, 0)), ('LINEBELOW', (0, 1), (-1, -1), .6, LINE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('LEFTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 1), (-1, -1), 6), ('BOTTOMPADDING', (0, 1), (-1, -1), 6)]))
    items += [tb, Spacer(1, 16)]

    items += [qr_block(made_on), PageBreak()]
    return items

def closing():
    return [Spacer(1, 6), box([
        p('Please check before you apply.', 'h2'),
        p('We worked hard to get this right, but programs, phone numbers and dates change. Check each program or its official page first. '
          'Westbrook Currents is independent. It is not run by the City of Westbrook or any agency listed here.'),
        Spacer(1, 4),
        pm(f'<b>See something wrong?</b> Tell us at {link(SITE_URL + "/feedback", "westbrookcurrents.com/feedback")} and we will check it.')],
        colors.HexColor('#e6f3f8'), colors.HexColor('#b7dcea'), width=W)]

# ---- Page furniture -------------------------------------------------------------
SINGLE = {
    'heating': ('Help Paying for Heat Guide', 'Programs that may help Westbrook residents pay for heat.'),
    'electricity': ('Help With the Electric Bill Guide', 'Programs that may help Westbrook residents pay the electric bill.'),
    'food': ('Help Getting Food Guide', 'Programs that may help Westbrook residents get food.'),
}

def make(made_on, slug=None):
    out = OUT if slug is None else os.path.join(SITE, 'public', f'westbrook-currents-{slug}-guide.pdf')
    guide_title = 'Westbrook Help Guide' if slug is None else SINGLE[slug][0]
    def later(canv, doc):
        canv.saveState()
        canv.setFillColor(NAVY); canv.rect(0, letter[1] - 0.32 * inch, letter[0], 0.32 * inch, stroke=0, fill=1)
        canv.setFillColor(colors.white); canv.setFont('Sans-Bold', 10)
        canv.drawString(0.7 * inch, letter[1] - 0.21 * inch, 'Westbrook Currents')
        canv.setFont('Sans', 10); canv.drawRightString(letter[0] - 0.7 * inch, letter[1] - 0.21 * inch, guide_title)
        footer(canv, doc); canv.restoreState()
    def first(canv, doc):
        canv.saveState(); footer(canv, doc); canv.restoreState()
    def footer(canv, doc):
        canv.setFillColor(MUTED); canv.setFont('Sans', 9)
        canv.drawString(0.7 * inch, 0.45 * inch, f'westbrookcurrents.com/help   |   Made {pretty_date(made_on)}')
        canv.drawRightString(letter[0] - 0.7 * inch, 0.45 * inch, f'Page {doc.page}')

    doc = BaseDocTemplate(out, pagesize=letter, leftMargin=0.7 * inch, rightMargin=0.7 * inch,
                          topMargin=0.62 * inch, bottomMargin=0.75 * inch,
                          title=guide_title, author='Westbrook Currents',
                          subject='Help with heat, electricity and food in Westbrook, Maine')
    fr1 = Frame(doc.leftMargin, doc.bottomMargin, W, letter[1] - doc.bottomMargin - 0.5 * inch, id='f1', leftPadding=0, rightPadding=0)
    fr2 = Frame(doc.leftMargin, doc.bottomMargin, W, letter[1] - doc.bottomMargin - doc.topMargin, id='f2', leftPadding=0, rightPadding=0)
    doc.addPageTemplates([PageTemplate('first', [fr1], onPage=first), PageTemplate('later', [fr2], onPage=later)])
    if slug is not None:
        doc.pageTemplates.reverse()  # single-topic guides start on the header-bar template

    from reportlab.platypus import NextPageTemplate
    heat = load('heating'); elec = load('electricity'); food = load('food')
    topics = [('Heating and Fuel', 'Help paying for heating oil, propane and other heat.'),
              ('Electricity', 'Help with your electric bill, payment plans and winter shutoff rules.'),
              ('Food', 'Pantries, SNAP, WIC, Meals on Wheels and more.')]
    if slug is None:
        story = [NextPageTemplate('later')] + cover(made_on, topics)
        story += topic_section('heating', 'Programs that may help Westbrook residents pay for heat.')
        story += [PageBreak()] + topic_section('electricity', 'Programs that may help Westbrook residents pay the electric bill.')
        story += [PageBreak()] + topic_section('food', 'Programs that may help Westbrook residents get food.')
        story += closing()
    else:
        # One topic only: no cover page. Page 1 uses the same header bar as the later pages.
        story = topic_section(slug, SINGLE[slug][1]) + [Spacer(1, 14), qr_block(made_on, '/help/' + slug), Spacer(1, 12)] + closing()
    doc.build(story)
    print('Wrote', out)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--date', default=datetime.date.today().isoformat(), help='date printed on the guide, YYYY-MM-DD')
    d = ap.parse_args().date
    make(d)
    for s in SINGLE:
        make(d, s)
