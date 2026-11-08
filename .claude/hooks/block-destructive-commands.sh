#!/usr/bin/env bash
# 데이터베이스 파괴 명령(DROP TABLE, DROP DATABASE, TRUNCATE 등) 차단 훅
# 실행 시도된 명령 문자열을 검사하여 파괴적 DB 명령이 감지되면 실행을 중단합니다.

INPUT="$@"
if [ -z "$INPUT" ]; then
  INPUT=$(cat)
fi

# 파괴적 명령 패턴 (대소문자 무시)
PATTERN="(DROP[[:space:]]+TABLE|DROP[[:space:]]+DATABASE|TRUNCATE|DROP[[:space:]]+SCHEMA)"

if echo "$INPUT" | grep -iqE "$PATTERN"; then
  echo "======================================================================" >&2
  echo "[차단] 데이터베이스 파괴 명령이 감지되었습니다!" >&2
  echo "사유: DROP TABLE, DROP DATABASE, TRUNCATE 등은 실행이 차단됩니다." >&2
  echo "안내: 데이터 삭제가 반드시 필요하다면 Supabase 웹 대시보드(SQL Editor)에서 사람이 직접 실행하세요." >&2
  echo "======================================================================" >&2
  exit 1
fi

exit 0
