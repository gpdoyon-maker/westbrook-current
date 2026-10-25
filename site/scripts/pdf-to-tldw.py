#!/usr/bin/env python3
"""Convert a TL;DW! summary PDF into structured JSON for the HTML summary page.

Usage: python3 scripts/pdf-to-tldw.py <slug> [<slug> ...]
Reads  public/tldw-<slug>.pdf  (via the markitdown CLI)
Writes src/data/tldw-summaries/<slug>.json

The HTML page (src/pages/tldw/[slug].astro) renders that JSON. Always look at the
generated page before publishing: PDF text can wrap oddly.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS = r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]'
LABELS = {'Discussion Summary', 'Key Decisions', 'Action Items'}
END = '.?!:;”")]'


def read_paragraphs(pdf):
    text = subprocess.run(['markitdown', str(pdf)], capture_output=True, text=True, check=True).stdout
    text = text.replace('\r', '').replace('(cid:127)', '•')
    paras, cur = [], []

    def flush():
        nonlocal cur
        if cur:
            paras.append(cur)
            cur = []

    for line in text.split('\n'):
        ln = line.strip()
        if not ln:
            flush()
        elif ln in LABELS:
            flush()
            paras.append([ln])  # a label is always its own paragraph
        else:
            cur.append(ln)
    flush()
    return paras


def join(lines):
    return re.sub(r'\s+', ' ', ' '.join(lines)).strip()


def merge_page_breaks(paras):
    """A page break can split one paragraph in two; glue them back together."""
    out = []
    for p in paras:
        if out:
            prev = out[-1]
            prev_text = join(prev)
            first = p[0]
            if (prev_text and prev_text[-1] not in END and len(prev_text) > 60
                    and first[:1].islower() and not first.startswith(('•',))):
                out[-1] = prev + p
                continue
        out.append(p)
    return out


def split_ts(text):
    m = re.search(TS + r'\s*$', text)
    if m:
        return text[:m.start()].strip(), m.group(1)
    return text, None


def parse(pdf):
    paras = merge_page_breaks(read_paragraphs(pdf))
    head = {'title': [], 'fields': {}}
    i = 0
    # Title lines (until "Date:")
    while i < len(paras) and not paras[i][0].startswith('Date:'):
        head['title'] += paras[i]
        i += 1
    # Field lines
    fields_lines = []
    while i < len(paras) and re.match(r'(Date|Time|Location|Video|Packet):', paras[i][0]):
        fields_lines += paras[i]
        i += 1
    key = None
    for ln in fields_lines:
        m = re.match(r'(Date|Time|Location|Video|Packet):\s*(.*)', ln)
        if m:
            key = m.group(1)
            head['fields'][key] = m.group(2)
        elif key:
            head['fields'][key] = (head['fields'][key] + ' ' + ln).strip()
    packet = head['fields'].get('Packet', '')
    pm = re.search(r'https?://\S+', packet)
    packet_url = pm.group(0) if pm else ''
    packet_note = re.sub(r'https?://\S+', '', packet).strip()

    note = ''
    blocks = []
    how_made = ''
    state = None  # 'kd' = inside Key Decisions, 'ai' = inside Action Items

    def last_heading_without_ts():
        for b in reversed(blocks):
            if b['t'] == 'h':
                return b if not b.get('ts') else None
            return None
        return None

    rest = paras[i:]
    k = 0
    while k < len(rest):
        p = rest[k]
        text = join(p)
        nxt = join(rest[k + 1]) if k + 1 < len(rest) else ''
        k += 1

        if text.startswith('Timestamps below'):
            continue
        if text.startswith('This summary highlights') and not blocks:
            note = text
            continue
        if text.startswith('Produced by Westbrook Currents'):
            continue
        if text == 'How this was made':
            if k < len(rest):
                how_made = join(rest[k])
                k += 1
            continue

        # a bare [timestamp] paragraph belongs to the heading just before it
        m = re.fullmatch(TS, text)
        if m and blocks and blocks[-1]['t'] == 'h':
            blocks[-1]['ts'] = m.group(1)
            continue

        # paragraph starting with a timestamp: that is the previous heading's timestamp
        m = re.match(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s+(.*)', text)
        if m and blocks and blocks[-1]['t'] == 'h' and not blocks[-1].get('ts'):
            blocks[-1]['ts'] = m.group(1)
            text = m.group(2)
            state = None
            blocks.append({'t': 'p', 'x': text})
            continue

        if text in LABELS:
            blocks.append({'t': 'label', 'x': text})
            state = 'kd' if text == 'Key Decisions' else 'ai' if text == 'Action Items' else None
            continue

        # quote + citation
        if text[:1] == '“' and nxt.startswith('—'):
            cite, ts = split_ts(join(rest[k]))
            blocks.append({'t': 'q', 'x': text, 'cite': cite.lstrip('— ').strip(), 'ts': ts})
            k += 1
            continue

        # heading with timestamp at the end of its (possibly two-line) first lines,
        # followed by body text in the same paragraph
        if len(p) > 1:
            for n in (1, 2):
                if n < len(p):
                    head_txt = join(p[:n])
                    if re.search(TS + r'\s*$', head_txt) and len(head_txt) < 140:
                        h, ts = split_ts(head_txt)
                        blocks.append({'t': 'h', 'x': h, 'ts': ts})
                        text = join(p[n:])
                        state = None
                        break

        if state == 'kd':
            items = []
            for ln in p:
                if re.match(r'3\s', ln):
                    items.append(ln[2:].strip())
                elif items:
                    items[-1] += ' ' + ln
                else:
                    items.append(ln)
            if len(join(p)) < 140 and not re.search(r'[.!?)”]$', join(p)) and nxt:
                state = None  # looks like a heading; fall through
            else:
                for it in items:
                    blocks.append({'t': 'd', 'x': re.sub(r'\s+', ' ', it)})
                continue
        elif state == 'ai':
            if text.startswith('•'):
                items = []
                for ln in p:
                    if ln.startswith('•'):
                        items.append(ln[1:].strip())
                    elif items:
                        items[-1] += ' ' + ln
                for it in items:
                    blocks.append({'t': 'a', 'x': re.sub(r'\s+', ' ', it)})
                continue
            if text == 'None.':
                blocks.append({'t': 'p', 'x': 'None.'})
                state = None
                continue
            state = None

        # plain paragraph vs heading
        looks_heading = (len(text) <= 130 and text[-1:] not in '.?!:;”"' and
                         not (text[-1:] == ')' and text.count('(') < text.count(')')) and
                         not text.startswith(('“', '—', '•')) and len(p) <= 3)
        if looks_heading or (len(p) <= 3 and re.search(TS + r"\s*$", text) and len(text) <= 240):
            h, ts = split_ts(text)
            blocks.append({'t': 'h', 'x': h, 'ts': ts})
            state = None
            continue

        blocks.append({'t': 'p', 'x': text})

    return {
        'title': ' — '.join(re.sub(r'^~\s*|\s*~$', '', t).strip() for t in head['title']),
        'fields': head['fields'],
        'packetUrl': packet_url,
        'packetNote': packet_note,
        'note': note,
        'blocks': blocks,
        'howMade': how_made,
    }


def main():
    out_dir = ROOT / 'src' / 'data' / 'tldw-summaries'
    out_dir.mkdir(parents=True, exist_ok=True)
    for slug in sys.argv[1:]:
        pdf = ROOT / 'public' / f'tldw-{slug}.pdf'
        data = parse(pdf)
        data['slug'] = slug
        (out_dir / f'{slug}.json').write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
        n_h = sum(1 for b in data['blocks'] if b['t'] == 'h')
        n_ts = sum(1 for b in data['blocks'] if b['t'] == 'h' and b.get('ts'))
        print(f'{slug}: {len(data["blocks"])} blocks, {n_h} headings ({n_ts} with timestamps)')


if __name__ == '__main__':
    main()
