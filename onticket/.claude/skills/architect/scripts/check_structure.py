#!/usr/bin/env python3
"""프로젝트 디렉토리 구조가 docs/가이드/프로젝트구조.md와 일치하는지 검사한다.

사용법:
  python3 scripts/check_structure.py [프로젝트_루트_경로]
"""
import sys
from pathlib import Path

# 가이드 문서 2.1, 3.1에 따른 필수 디렉터리 목록 (onticket 기준)
REQUIRED_DIRS = [
    # 공통 폴더
    "data",
    "docs",
    "design",
    # web 폴더 (Next.js)
    "web/app",
    "web/components/ui",
    "web/lib/api-client",
    "web/types",
    # api 폴더 (Hono on Cloudflare Workers)
    "api/src",
    "api/src/routes",
    "api/src/services",
    "api/src/repositories",
    "api/src/schemas",
    "api/src/lib",
]

REQUIRED_FILES = [
    # web 필수 파일
    "web/package.json",
    "web/tsconfig.json",
    "web/.env.example",
    "web/app/layout.tsx",
    "web/app/page.tsx",
    "web/lib/api-client/client.ts",
    # api 필수 파일
    "api/package.json",
    "api/tsconfig.json",
    "api/wrangler.toml",
    "api/.env.example",
    "api/src/index.ts",
    "api/src/lib/http.ts",
    "api/src/lib/auth.ts",
]

# 상위 폴더 오염 금지 검사항목
FORBIDDEN_PARENT_DIRS = [
    "../api",
    "../web",
]


def check_structure(root_path: Path) -> list[str]:
    errs = []

    # 1. 상위 폴더 오염 여부 검사
    for fb in FORBIDDEN_PARENT_DIRS:
        target = (root_path / fb).resolve()
        # root_path 바로 바깥(상위)에 api나 web이 존재하는지 확인
        if target.exists() and target != root_path:
            errs.append(f"[상위 오염] 상위 디렉터리에 잘못 생성된 폴더가 있습니다: {target}")

    # 2. 필수 디렉터리 존재 여부
    for d in REQUIRED_DIRS:
        p = root_path / d
        if not p.is_dir():
            errs.append(f"[디렉터리 누락] 가이드 문서의 필수 폴더가 없습니다: {d}")

    # 3. 필수 파일 존재 여부
    for f in REQUIRED_FILES:
        p = root_path / f
        if not p.is_file():
            errs.append(f"[파일 누락] 가이드 문서의 필수 파일이 없습니다: {f}")

    return errs


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    # onticket 폴더를 찾기
    if not (root / "docs/가이드/프로젝트구조.md").exists() and (root / "onticket/docs/가이드/프로젝트구조.md").exists():
        root = root / "onticket"

    errs = check_structure(root)
    if errs:
        print(f"FAIL ({len(errs)}건의 구조 불일치 발견):")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("OK: 프로젝트 구조가 docs/가이드/프로젝트구조.md와 100% 일치합니다.")


if __name__ == "__main__":
    main()
