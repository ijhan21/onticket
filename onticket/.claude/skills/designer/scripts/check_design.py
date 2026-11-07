"""시안·프로토타입이 design/tokens.css 밖의 값을 쓰지 않았는지, 금지 항목을 피했는지 검사한다.

사용: python3 -I .claude/skills/designer/scripts/check_design.py design/시안 [design/tokens.css] [design/금지목록.md]
대상 폴더의 .html·.css·.js를 본다(tokens.css 자체는 제외).

검사 항목
 1. var(--이름)이 tokens.css에 정의돼 있다
 2. 색·간격·글자·둥글기 속성에 토큰 밖 값(HEX, rgb/hsl, 색 이름, px/rem/em, 글꼴 이름)이 없다
 3. box-shadow를 쓰지 않는다(none 제외)
 4. 화면에 보이는 글자에 브랜드 금지 표현·느낌표·이모지가 없다
 5. 금지목록.md에 백틱으로 적힌 표현이 화면 글자에 없다
 6. tokens.css를 불러온다(HTML)
 7. 그라데이션이 없다(금지목록 1)
 8. <img>는 공연 포스터만 — alt에 '포스터'가 들어간다(금지목록 6)
 9. 애니메이션은 로딩용(이름에 loading·spin·skeleton)만, 시간 값은 토큰으로(금지목록 9)
10. 글자 크기 키워드(larger 등)를 쓰지 않는다 — 크기는 토큰 네 단계뿐(금지목록 10)
 OK일 때 강조색(--color-accent)을 쓴 선택자를 나열한다 — 세 자리(예매 버튼·가격·워드마크 마침표)인지 사람이 확인한다(금지목록 3)
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

BANNED = ["지금 바로", "놓치지 마세요", "최고의", "완벽한", "축하합니다", "서두르세요"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐⭕]")
TOKEN_PROPS = re.compile(
    r"^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|"
    r"margin(-(top|right|bottom|left|inline|block)(-(start|end))?)?|padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?|"
    r"gap|row-gap|column-gap|font|font-family|font-size|line-height|letter-spacing|border-radius|text-decoration-color|caret-color|accent-color)$"
)
COLOR_NAMES = r"\b(white|black|red|orange|gray|grey|blue|green|yellow|purple|pink|silver|navy)\b"
ALLOWED_WORDS = {"none", "auto", "inherit", "initial", "unset", "transparent", "currentcolor", "solid", "dashed", "dotted", "0"}


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts: list[str] = []
        self.styles: list[str] = []
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if a.get("style"):
            self.styles.append(a["style"])
        if tag == "link" and a.get("href"):
            self.links.append(a["href"])
        for k in ("alt", "placeholder", "aria-label", "title", "value"):
            if a.get(k) and not (tag == "input" and k == "value" and a.get("type") in ("hidden",)):
                self.parts.append(a[k])

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def declarations(css: str):
    """(선택자, 속성, 값)을 돌려준다. 중괄호가 없는 style 속성 값은 선택자를 'style 속성'으로 둔다."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    blocks = re.findall(r"([^{}]*)\{([^{}]*)\}", css) if "{" in css else [("style 속성", css)]
    for sel, body in blocks:
        for prop, val in re.findall(r"([a-zA-Z-]+)\s*:\s*([^;{}]+)", body):
            yield " ".join(sel.split()) or "?", prop.strip().lower(), val.strip()


def bad_value(val: str) -> str | None:
    v = re.sub(r"var\(--[\w-]+(\s*,[^)]*)?\)", "", val)
    v = re.sub(r"calc\(|\)|[*/+]", " ", v)
    if re.search(r"#[0-9a-fA-F]{3,8}\b", v):
        return "HEX 색"
    if re.search(r"\b(rgb|rgba|hsl|hsla|oklch|lab)\(", val):
        return "색 함수"
    if re.search(COLOR_NAMES, v, re.I):
        return "색 이름"
    if re.search(r"(?<![\w-])(?!0(px|rem|em)\b)\d*\.?\d+(px|rem|em)\b", v):
        return "px/rem/em 값"
    if re.search(r"\b(larger|smaller|xx-small|x-small|small|medium|large|x-large|xx-large)\b", v):
        return "글자 크기 키워드"
    if re.search(r"[\"'][^\"']+[\"']", v) or re.search(r"\b(sans-serif|serif|monospace|Pretendard|Arial|Helvetica)\b", v, re.I):
        return "글꼴 이름"
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1])
    tokens_path = Path(sys.argv[2] if len(sys.argv) > 2 else "design/tokens.css")
    ban_path = Path(sys.argv[3] if len(sys.argv) > 3 else "design/금지목록.md")
    errs: list[str] = []
    if not tokens_path.exists():
        sys.exit(f"{tokens_path}가 없다 — 시안·프로토타입을 만들지 않는다")
    defined = set(re.findall(r"(--[\w-]+)\s*:", tokens_path.read_text(encoding="utf-8")))
    banned = list(BANNED)
    if ban_path.exists():
        bt = ban_path.read_text(encoding="utf-8")
        found = re.findall(r"`([^`\n]{2,40})`", bt) + re.findall(r"[\"“]([^\"”\n]{2,40})[\"”]", bt)
        banned += [b for b in found if not re.fullmatch(r"[\w.-]+", b)]
        banned += [b.split()[0] + " " + b.split()[1] for b in found if len(b.split()) > 2]  # "지금 바로 시작하세요" 류 → "지금 바로"
        banned = list(dict.fromkeys(banned))
    else:
        errs.append(f"[금지목록] {ban_path}가 없다")

    accent_uses: list[str] = []
    files = [p for p in root.rglob("*") if p.suffix in (".html", ".css", ".js") and p.resolve() != tokens_path.resolve()]
    if not files:
        sys.exit(f"검사할 파일이 없다: {root}")
    for p in files:
        src = p.read_text(encoding="utf-8")
        rel = p.relative_to(root)
        css_chunks = []
        if p.suffix == ".css":
            css_chunks.append(src)
        if p.suffix == ".html":
            css_chunks += re.findall(r"<style[^>]*>(.*?)</style>", src, re.S)
            t = Text()
            t.feed(src)
            css_chunks += t.styles
            for img in re.findall(r"<img\b[^>]*>", src, re.I):
                alt = re.search(r"alt\s*=\s*[\"']([^\"']*)", img)
                if not alt or "포스터" not in alt.group(1):
                    errs.append(f"[금지] {rel}: 공연 포스터가 아닌 이미지(alt에 '포스터' 없음) (금지목록 6)")
            if not any(l.endswith("tokens.css") for l in t.links):
                errs.append(f"[토큰] {rel}: tokens.css를 불러오지 않는다")
            text = " ".join(t.parts)
            for b in banned:
                if b in text and not any(b != o and b in o and o in text for o in banned):
                    errs.append(f"[문구] {rel}: 금지 표현 '{b}'")
            if "!" in text:
                errs.append(f"[문구] {rel}: 화면 글자에 느낌표가 있다")
            if EMOJI.search(text):
                errs.append(f"[문구] {rel}: 이모지가 있다")
        scripts = [src] if p.suffix == ".js" else (re.findall(r"<script[^>]*>(.*?)</script>", src, re.S) if p.suffix == ".html" else [])
        for js in scripts:
            for s in re.findall(r"style\.(?:cssText|setProperty)\s*\(?\s*[\"'`]([^\"'`]+)", js):
                css_chunks.append(s)
            for prop, val in re.findall(r"style\.(\w+)\s*=\s*[\"'`]([^\"'`]+)", js):
                css_chunks.append(re.sub(r"([A-Z])", r"-\1", prop).lower() + ":" + val)
        for name in re.findall(r"@keyframes\s+([\w-]+)", " ".join(css_chunks)):
            if not re.search(r"loading|spin|skeleton", name):
                errs.append(f"[금지] {rel}: 장식용으로 보이는 @keyframes {name} (금지목록 9)")
        used = set()
        for css in css_chunks:
            used |= set(re.findall(r"var\((--[\w-]+)", css))
            for sel, prop, val in declarations(css):
                if prop.startswith("--"):
                    errs.append(f"[토큰] {rel}: 토큰 '{prop}'을 tokens.css 밖에서 새로 정의했다")
                    continue
                if "gradient(" in val:
                    errs.append(f"[금지] {rel}: 그라데이션 '{prop}: {val}' (금지목록 1)")
                if prop in ("animation", "animation-name") and val.lower() != "none" and not re.search(r"loading|spin|skeleton", val):
                    errs.append(f"[금지] {rel}: 장식용으로 보이는 애니메이션 '{val}' (금지목록 9)")
                if prop.startswith(("transition", "animation")) and re.search(r"(?<![\w-])\d*\.?\d+m?s\b", re.sub(r"var\(--[\w-]+\)", "", val)):
                    errs.append(f"[값] {rel}: {prop}: {val} — 시간은 --duration-* 토큰으로")
                if "--color-accent" in val:
                    accent_uses.append(f"{rel}: {sel} {{ {prop} }}")
                if prop == "box-shadow" and val.lower() != "none":
                    errs.append(f"[금지] {rel}: box-shadow '{val}'")
                elif TOKEN_PROPS.match(prop):
                    why = bad_value(val)
                    if why:
                        errs.append(f"[값] {rel}: {prop}: {val} — 토큰 밖 값({why})")
        for name in sorted(used - defined):
            errs.append(f"[토큰] {rel}: {name}이 tokens.css에 없다")

    if errs:
        print(f"위반 {len(errs)}건")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print(f"OK — 파일 {len(files)}개, 토큰 {len(defined)}개 기준")
    print(f"강조색 사용 {len(accent_uses)}곳 — 예매 버튼·가격·워드마크 마침표뿐인지 확인한다:")
    for u in accent_uses:
        print("  ·", u)


if __name__ == "__main__":
    main()
