#!/usr/bin/env python3
"""Safely attach original Board JSON asset IDs to a lecture Slides ZIP.

Usage:
  python3 repair_lecture_slides_improved.py Lecture_Slides.zip 2_board.json repaired.zip
  python3 repair_lecture_slides_improved.py Lecture_Slides.zip 2_board.json repaired.zip --mapping mapping.json

No source guessing: ZIP sequence, asset_N, or equal file counts do not prove URL->image matches.
Mapping JSON: {"4_asset_2.pdf":"https://.../document.pdf?page=3&t=..."}
Output keeps original image bytes/names and adds _slides_mapping.json + _repair_report.json.
"""
import argparse
import hashlib
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.pdf'}


def flatten(obj):
    if isinstance(obj, list):
        for item in obj:
            yield from flatten(item)
    elif isinstance(obj, dict):
        if 'plugin' in obj and 'p_time' in obj:
            yield obj
        else:
            for item in obj.values():
                yield from flatten(item)


def identity(url):
    if not isinstance(url, str) or not url.startswith(('http://','https://')):
        return None
    parts = urlsplit(url)
    page = parse_qs(parts.query).get('page', [None])[0]
    if re.search(r'\.pdf$', parts.path, re.I) and page is not None:
        try:
            return f'{parts.scheme.lower()}://{parts.netloc.lower()}{parts.path.lower()}?page={int(page)}'
        except ValueError:
            return None
    return f'{parts.scheme.lower()}://{parts.netloc.lower()}{parts.path.lower()}'


def detect(raw):
    if raw.startswith(b'\xff\xd8\xff'): return 'jpg'
    if raw.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP': return 'webp'
    if raw.startswith(b'%PDF-'): return 'pdf'
    return 'unknown'


def repair(old, board, target, mapping_file=None):
    events = sorted(flatten(json.loads(Path(board).read_text(encoding='utf-8-sig'))),
                    key=lambda e: (float(e.get('p_time',0)), int(e.get('id',0))))
    refs = {}
    for ev in events:
        d = ev.get('data') or {}
        if ev.get('plugin') == 'dcn' and d.get('e') == 'as' and d.get('u'):
            source = identity(d['u'])
            if source: refs.setdefault(source, d['u'])

    explicit = json.loads(Path(mapping_file).read_text()) if mapping_file else {}
    if not isinstance(explicit, dict): raise ValueError('Mapping must be a JSON object: ZIP filename -> source URL')
    contents, matched, unmatched, duplicate = {}, {}, [], defaultdict(list)
    with zipfile.ZipFile(old) as archive:
        for item in archive.infolist():
            if item.is_dir() or item.filename in ('_slides_mapping.json','_repair_report.json'):
                continue
            # Do not alter unrelated ZIP members.
            raw = archive.read(item.filename)
            contents[item.filename] = raw
            if Path(item.filename).suffix.lower() not in IMAGE_EXT: continue
            kind = detect(raw)
            digest = hashlib.sha256(raw).hexdigest()
            duplicate[digest].append(item.filename)
            if kind == 'unknown':
                unmatched.append({'file':item.filename,'reason':'unrecognized file bytes'}); continue
            url = explicit.get(item.filename) or explicit.get(Path(item.filename).name)
            if url:
                canonical = identity(url)
                if canonical not in refs:
                    raise ValueError(f'Mapping for {item.filename} is not in Board JSON: {url}')
                if canonical in matched.values():
                    raise ValueError(f'Duplicate URL/page used for more than one asset: {canonical}')
                matched[item.filename] = canonical
                continue
            # Only an exact URL basename can safely identify a non-PDF-page asset.
            basename = Path(item.filename).name.lower()
            candidates = [k for k in refs if '?page=' not in k and k.rsplit('/',1)[-1] == basename]
            if len(candidates) == 1 and candidates[0] not in matched.values():
                matched[item.filename] = candidates[0]
            else:
                unmatched.append({'file':item.filename,'reason':'source URL/page not provable from ZIP filename'})

    hashes = [names for names in duplicate.values() if len(names) > 1]
    report = {
        'total_json_asset_references':len(refs),
        'zip_media_files':len(matched)+len(unmatched),
        'verified_mapping_count':len(matched),
        'unresolved_zip_files':unmatched,
        'unresolved_json_references': sorted(set(refs)-set(matched.values())),
        'identical_file_groups':hashes,
        'warning':'Unresolved entries are deliberately NOT assigned by ZIP order or page number. This avoids false slide matches.'
    }
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as dst:
        for filename,raw in contents.items(): dst.writestr(filename,raw)
        # Server reads keys as original archive member names.
        dst.writestr('_slides_mapping.json',json.dumps(matched,indent=2))
        dst.writestr('_repair_report.json',json.dumps(report,indent=2))
    with zipfile.ZipFile(target) as check:
        failure=check.testzip()
        if failure: raise ValueError('ZIP integrity check failed: '+failure)
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('zip')
    ap.add_argument('board')
    ap.add_argument('output')
    ap.add_argument('--mapping',help='Optional verified filename-to-URL JSON')
    args=ap.parse_args()
    result=repair(args.zip,args.board,args.output,args.mapping)
    print(json.dumps({k:v if not isinstance(v,list) else len(v) for k,v in result.items()},indent=2))
    print('Written:',args.output)
