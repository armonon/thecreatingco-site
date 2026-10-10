#!/usr/bin/env python3
"""Bounded, read-only audit of public sitemap pages and SEO metadata."""
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

BASE = "https://thecreatingco.com"
HOST = urllib.parse.urlsplit(BASE).hostname
LIMIT = 100
BODY_LIMIT = 2_000_000
TIMEOUT = 12
UA = "W09-public-SEO-audit/1.0 (bounded read-only)"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xml,text/plain,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read(BODY_LIMIT + 1)
            return {"requested_url": url, "status": r.status, "final_url": r.geturl(),
                    "content_type": r.headers.get("Content-Type", ""), "body": raw[:BODY_LIMIT],
                    "truncated": len(raw) > BODY_LIMIT, "error": None}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        status = getattr(getattr(e, "response", None), "status", None)
        return {"requested_url": url, "status": status, "final_url": getattr(e, "url", url),
                "content_type": "", "body": b"", "truncated": False, "error": type(e).__name__ + ": " + str(e)[:240]}

def sha(b): return hashlib.sha256(b).hexdigest()
def same_host(url):
    try: return urllib.parse.urlsplit(url).hostname == HOST and urllib.parse.urlsplit(url).scheme in ("http", "https")
    except ValueError: return False

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.canon=[]; self.meta=[]; self.title=None; self.in_title=False; self.title_parts=[]; self.ld=[]; self.in_ld=False; self.ld_parts=[]
    def handle_starttag(self, tag, attrs):
        a={k.lower():v for k,v in attrs}
        if tag.lower()=="link" and "canonical" in (a.get("rel") or "").lower().split(): self.canon.append(a.get("href"))
        if tag.lower()=="meta": self.meta.append({"name":a.get("name"),"property":a.get("property"),"content":a.get("content")})
        if tag.lower()=="title": self.in_title=True
        if tag.lower()=="script" and (a.get("type") or "").lower().split(";")[0].strip()=="application/ld+json": self.in_ld=True; self.ld_parts=[]
    def handle_endtag(self, tag):
        if tag.lower()=="title" and self.in_title: self.title="".join(self.title_parts).strip(); self.in_title=False
        if tag.lower()=="script" and self.in_ld: self.ld.append("".join(self.ld_parts)); self.in_ld=False
    def handle_data(self, d):
        if self.in_title: self.title_parts.append(d)
        if self.in_ld: self.ld_parts.append(d)

def meta_value(meta, key, value):
    return [x.get("content") for x in meta if (x.get(key) or "").lower()==value]

def flatten_types(obj):
    out=[]
    if isinstance(obj, dict):
        t=obj.get("@type")
        if isinstance(t,str): out.append(t)
        elif isinstance(t,list): out.extend(str(x) for x in t)
        for v in obj.values(): out.extend(flatten_types(v))
    elif isinstance(obj,list):
        for v in obj: out.extend(flatten_types(v))
    return out

def webpage_identity_findings(obj, canonical, final):
    findings=[]
    if isinstance(obj,dict):
        typ=obj.get("@type",[]); typ=[typ] if isinstance(typ,str) else typ
        if any(str(t).lower().endswith("webpage") for t in typ):
            for key in ("url","@id"):
                v=obj.get(key)
                if isinstance(v,str) and v.startswith(("http://","https://")):
                    if urllib.parse.urldefrag(v)[0].rstrip("/") not in {canonical.rstrip("/"),final.rstrip("/")}:
                        findings.append({"field":key,"value":v,"reason":"WebPage node identity differs from page canonical/final URL"})
            v=obj.get("mainEntityOfPage")
            if isinstance(v,str) and v.startswith(("http://","https://")) and urllib.parse.urldefrag(v)[0].rstrip("/") not in {canonical.rstrip("/"),final.rstrip("/")}:
                findings.append({"field":"mainEntityOfPage","value":v,"reason":"WebPage node identity differs from page canonical/final URL"})
        for x in obj.values(): findings.extend(webpage_identity_findings(x,canonical,final))
    elif isinstance(obj,list):
        for x in obj: findings.extend(webpage_identity_findings(x,canonical,final))
    return findings

def audit_page(record):
    raw=record.pop("body"); text=raw.decode("utf-8", "replace")
    p=Page()
    try: p.feed(text)
    except Exception: pass
    final=record["final_url"]
    resolved=[urllib.parse.urljoin(final, c) if c else None for c in p.canon]
    ld=[]; types=[]; errors=[]; id_issues=[]
    for i,s in enumerate(p.ld):
        try:
            obj=json.loads(s); ld.append({"index":i,"valid_json":True}); types.extend(flatten_types(obj))
            id_issues.extend(webpage_identity_findings(obj,resolved[0] if resolved else "",final))
        except Exception as e:
            ld.append({"index":i,"valid_json":False,"error":type(e).__name__})
    if len(p.canon)!=1: errors.append("canonical_count="+str(len(p.canon)))
    elif resolved[0] and urllib.parse.urldefrag(resolved[0])[0].rstrip("/") != urllib.parse.urldefrag(final)[0].rstrip("/"):
        errors.append("canonical_does_not_match_final_url")
    og=meta_value(p.meta,"property","og:url")
    if len(og)>1: errors.append("multiple_og_url")
    if og and og[0]:
        o=urllib.parse.urljoin(final,og[0])
        if urllib.parse.urldefrag(o)[0].rstrip("/") != urllib.parse.urldefrag(final)[0].rstrip("/"): errors.append("og_url_does_not_match_final_url")
    return {**record,"raw_sha256":sha(raw),"canonical_count":len(p.canon),"canonical_raw":p.canon,"canonical_resolved":resolved,
            "title":p.title,"meta_description":meta_value(p.meta,"name","description"),"og_url":og,
            "jsonld_blocks":ld,"jsonld_types":sorted(set(types)),"structural_findings":errors,"jsonld_identity_findings":id_issues}

def main():
    start=dt.datetime.now(dt.timezone.utc)
    robots=get(BASE+"/robots.txt"); robots_text=robots["body"].decode("utf-8","replace")
    sitemap_refs=[m.group(1).strip() for m in re.finditer(r"(?im)^\s*sitemap\s*:\s*(\S+)",robots_text)]
    sm=get(BASE+"/sitemap.xml")
    sitemap_urls=[]; sitemap_error=None; discovered=[]; child_maps=[]
    def parse_map(url, body):
        nonlocal sitemap_error
        # Regex fallback is deliberate: this host's Python build has no Expat,
        # so ElementTree cannot parse XML. Sitemap loc values are plain text.
        s=body.decode("utf-8","replace")
        m=re.search(r"<\s*(?:[\w.-]+:)?(urlset|sitemapindex)\b",s,re.I)
        if not m:
            sitemap_error="XML_root_not_found (stdlib XML parser unavailable: no expat)"; return None
        for loc in re.findall(r"<\s*(?:[\w.-]+:)?loc\s*>(.*?)<\s*/\s*(?:[\w.-]+:)?loc\s*>",s,re.I|re.S):
            value=html.unescape(re.sub(r"<[^>]*>","",loc)).strip()
            if value: discovered.append(value)
        return m.group(1).lower()
    sm_kind=parse_map(sm["requested_url"], sm["body"])
    if sm_kind=="sitemapindex":
        children=discovered[:20]; discovered.clear()
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            maps=list(pool.map(get, [u for u in children if same_host(u)]))
        for mr in maps:
            before=len(discovered); child_kind=parse_map(mr["requested_url"],mr["body"])
            child_maps.append({"requested_url":mr["requested_url"],"status":mr["status"],"final_url":mr["final_url"],"content_type":mr["content_type"],"raw_sha256":sha(mr["body"]),"error":mr["error"],"root_type":child_kind,"loc_count":len(discovered)-before})
    # Preserve original sitemap sequence while deduplicating; audit at most 100 same-host entries.
    seen=set()
    for u in discovered:
        if u not in seen and same_host(u): seen.add(u); sitemap_urls.append(u)
    selected=sitemap_urls[:LIMIT]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        page_records=list(pool.map(get, selected))
    pages=[audit_page(r) for r in page_records]
    end=dt.datetime.now(dt.timezone.utc)
    evidence={"audit":{"started_utc":start.isoformat(),"finished_utc":end.isoformat(),"duration_seconds":round((end-start).total_seconds(),3),"base":BASE,"limits":{"pages":LIMIT,"concurrency":6,"timeout_seconds":TIMEOUT,"body_bytes_per_response":BODY_LIMIT},"method":"Python standard library urllib; GET only; no forms or site mutations"},
      "robots":{"requested_url":robots["requested_url"],"status":robots["status"],"final_url":robots["final_url"],"content_type":robots["content_type"],"raw_sha256":sha(robots["body"]),"truncated":robots["truncated"],"error":robots["error"],"sitemap_directives":sitemap_refs,"policy_lines":[line.strip() for line in robots_text.splitlines() if re.match(r"(?i)^\s*(user-agent|allow|disallow|crawl-delay)\s*:",line)]},
      "sitemap":{"requested_url":sm["requested_url"],"status":sm["status"],"final_url":sm["final_url"],"content_type":sm["content_type"],"raw_sha256":sha(sm["body"]),"truncated":sm["truncated"],"error":sm["error"],"root_type":sm_kind,"parse_error":sitemap_error,"robots_sitemap_directives":sitemap_refs,"child_sitemaps":child_maps,"discovered_entries_total":len(discovered),"same_host_unique_entries":len(sitemap_urls),"audited_entries":len(selected),"omitted_due_to_limit":max(0,len(sitemap_urls)-len(selected)),"entries":pages},
      "scope_note":"Structural observations only; not a Google indexability, rich-result eligibility, traffic, or ranking determination. External destinations in SoftwareApplication/Product nodes are not treated as identity inconsistencies; identity checks apply only to nodes typed WebPage."}
    out=sys.argv[1] if len(sys.argv)>1 else "evidence.json"
    with open(out,"w",encoding="utf-8") as f: json.dump(evidence,f,indent=2,ensure_ascii=False); f.write("\n")
    ok=sum(x["status"]==200 for x in pages); mism=sum(bool(x["structural_findings"]) for x in pages)
    print(json.dumps({"robots_status":robots["status"],"sitemap_status":sm["status"],"entries_discovered":len(sitemap_urls),"audited":len(pages),"page_http_200":ok,"pages_with_structural_findings":mism,"evidence":out},indent=2))

if __name__=="__main__": main()
