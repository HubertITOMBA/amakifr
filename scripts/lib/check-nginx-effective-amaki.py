#!/usr/bin/env python3
"""
Vérifie (lecture seule) qu'une dump nginx -T contient un proxy amaki.fr → 127.0.0.1:9060
avec X-Real-IP $remote_addr et X-Forwarded-For $proxy_add_x_forwarded_for.

N'affiche jamais de certificats PEM ni le dump complet.
Sortie : OK sur stdout (succès) ou message FATAL court sur stderr (échec).
Code retour : 0 OK, 1 refus, 2 entrée ambiguë/inaccessible.
"""
from __future__ import annotations

import re
import sys
from typing import List, Optional, Tuple

PEM_RE = re.compile(
    r"-----BEGIN [A-Z0-9 ]+-----.*?-----END [A-Z0-9 ]+-----",
    re.DOTALL,
)
UPSTREAM_RE = re.compile(r"upstream\s+([A-Za-z0-9_.-]+)\s*\{", re.IGNORECASE)
SERVER_RE = re.compile(r"\bserver\s*\{", re.IGNORECASE)
LOCATION_RE = re.compile(
    r"location\s*(=|~\*?|\^~)?\s*([^\s{]+)?\s*\{", re.IGNORECASE
)
SERVER_NAME_RE = re.compile(r"server_name\s+([^;]+);", re.IGNORECASE)
PROXY_PASS_RE = re.compile(r"proxy_pass\s+([^;]+);", re.IGNORECASE)
X_REAL_RE = re.compile(
    r"proxy_set_header\s+X-Real-IP\s+(\S+)\s*;", re.IGNORECASE
)
X_FF_RE = re.compile(
    r"proxy_set_header\s+X-Forwarded-For\s+(\S+)\s*;", re.IGNORECASE
)

AMAKI_NAMES = {"amaki.fr", "www.amaki.fr"}


def strip_pem(text: str) -> str:
    return PEM_RE.sub("# <pem redacted>", text)


def find_matching_brace(text: str, open_idx: int) -> int:
    """open_idx pointe sur '{' ; retourne l'index du '}' apparié ou -1."""
    depth = 0
    i = open_idx
    n = len(text)
    while i < n:
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def iter_blocks(text: str, pattern: re.Pattern[str]) -> List[Tuple[int, int, re.Match[str]]]:
    out: List[Tuple[int, int, re.Match[str]]] = []
    for m in pattern.finditer(text):
        brace = text.find("{", m.end() - 1)
        if brace < 0:
            continue
        end = find_matching_brace(text, brace)
        if end < 0:
            continue
        out.append((brace + 1, end, m))
    return out


def parse_upstreams(text: str) -> dict[str, list[str]]:
    ups: dict[str, list[str]] = {}
    for start, end, m in iter_blocks(text, UPSTREAM_RE):
        name = m.group(1)
        body = text[start:end]
        servers = []
        for sm in re.finditer(r"server\s+([^;]+);", body, re.IGNORECASE):
            host = sm.group(1).strip().split()[0]
            servers.append(host)
        ups[name] = servers
    return ups


def target_is_loopback_9060(target: str, ups: dict[str, list[str]]) -> bool:
    t = target.strip()
    # http://127.0.0.1:9060/... or http://127.0.0.1:9060
    m = re.match(r"https?://([^/\s]+)", t, re.IGNORECASE)
    if not m:
        return False
    hostport = m.group(1)
    if hostport in ("127.0.0.1:9060", "localhost:9060"):
        return True
    # upstream name (optionally with URI path already stripped from hostport)
    uname = hostport.split(":")[0]
    if uname in ups:
        for s in ups[uname]:
            if s in ("127.0.0.1:9060", "localhost:9060"):
                return True
            if s.startswith("127.0.0.1:") and s.endswith(":9060"):
                return True
    return False


def server_names(body: str) -> set[str]:
    names: set[str] = set()
    for m in SERVER_NAME_RE.finditer(body):
        for part in m.group(1).split():
            names.add(part.strip().lower().rstrip(";"))
    return names


def is_amaki_server(body: str) -> bool:
    return bool(server_names(body) & AMAKI_NAMES)


def analyze(dump: str) -> Tuple[int, str]:
    if not dump or not dump.strip():
        return 2, "dump nginx vide ou inaccessible"

    text = strip_pem(dump)
    ups = parse_upstreams(text)

    # Collect locations that proxy to 9060 inside amaki.fr servers
    qualifying: List[dict] = []
    ambiguous_reasons: List[str] = []

    server_blocks = iter_blocks(text, SERVER_RE)
    amaki_servers = 0
    for s_start, s_end, _ in server_blocks:
        sbody = text[s_start:s_end]
        if not is_amaki_server(sbody):
            continue
        amaki_servers += 1

        # locations nested in this server only (search within sbody)
        for l_start, l_end, lm in iter_blocks(sbody, LOCATION_RE):
            lbody = sbody[l_start:l_end]
            modifier = (lm.group(1) or "").strip()
            path = (lm.group(2) or "").strip() or "/"
            pp_m = PROXY_PASS_RE.search(lbody)
            if not pp_m:
                continue
            pp = pp_m.group(1).strip()
            if not target_is_loopback_9060(pp, ups):
                # proxy ailleurs — ignorer pour le critère 9060
                continue

            xreal_m = X_REAL_RE.search(lbody)
            xff_m = X_FF_RE.search(lbody)
            xreal = xreal_m.group(1) if xreal_m else None
            xff = xff_m.group(1) if xff_m else None

            qualifying.append(
                {
                    "path": path,
                    "modifier": modifier,
                    "proxy_pass": pp,
                    "xreal": xreal,
                    "xff": xff,
                    "body": lbody,
                }
            )

    if amaki_servers == 0:
        return 1, "aucun server_name amaki.fr/www.amaki.fr dans la conf effective"

    if not qualifying:
        return 1, "aucun proxy_pass amaki.fr vers 127.0.0.1:9060 (upstream inclus)"

    # Locations « catch-all » ou racine qui desservent l'app
    rootish = [
        q
        for q in qualifying
        if q["path"] in ("/", "") or (q["modifier"] in ("",) and q["path"] == "/")
    ]
    # Aussi location sans modificateur path /
    if not rootish:
        # Si seule une location regex opaque proxy 9060 — ambigu
        return 2, "proxy 9060 présent mais aucune location / claire (ambigu)"

    if len(rootish) > 1:
        return 2, "plusieurs location / (ou équivalentes) proxy 9060 — ambigu"

    # Toute location proxy 9060 doit avoir les headers corrects (pas de contournement)
    for q in qualifying:
        if q["xreal"] is None:
            return 1, f"X-Real-IP absent sur location {q['path']} → 9060"
        if q["xreal"] != "$remote_addr":
            if q["xreal"] in ("$http_x_real_ip", "$proxy_add_x_forwarded_for") or q[
                "xreal"
            ].startswith("$http_"):
                return 1, "X-Real-IP contrôlé par le client (interdit)"
            return 1, f"X-Real-IP invalide ({q['xreal']}) — exigé $remote_addr"
        if q["xff"] is None:
            return 1, f"X-Forwarded-For absent sur location {q['path']} → 9060"
        if q["xff"] != "$proxy_add_x_forwarded_for":
            if q["xff"].startswith("$http_"):
                return 1, "X-Forwarded-For contrôlé par le client (interdit)"
            return 1, "X-Forwarded-For doit être $proxy_add_x_forwarded_for"

    # Upstream / proxy_pass doivent cibler loopback 9060 (déjà filtré) — vérifier mauvais upstream explicite
    for q in rootish:
        if not target_is_loopback_9060(q["proxy_pass"], ups):
            return 1, "mauvais upstream/proxy_pass (pas 127.0.0.1:9060)"

    # Contournement : location plus spécifique proxy 9060 sans headers déjà couvert.
    # Contournement alternatif : location / sans proxy mais une autre route — OK.
    _ = ambiguous_reasons  # réservé

    return 0, "OK nginx effective amaki.fr → 127.0.0.1:9060 + X-Real-IP $remote_addr"


def main(argv: List[str]) -> int:
    if len(argv) > 1 and argv[1] != "-":
        try:
            with open(argv[1], "r", encoding="utf-8", errors="replace") as f:
                dump = f.read()
        except OSError as e:
            print(f"FATAL: lecture dump nginx impossible ({e})", file=sys.stderr)
            return 2
    else:
        dump = sys.stdin.read()

    code, msg = analyze(dump)
    if code == 0:
        print(msg)
        return 0
    print(f"FATAL: {msg}", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
