#!/usr/bin/env python3
"""Antigravity Stop Hook: TypeSafe jev 루브릭 품질 게이트 연동

에이전트가 작업을 마치고 종료(NO_TOOL_CALL)하려 할 때 jev를 자동 실행하여
루브릭 채점이 통과([PASS])되지 않으면 작업 종료를 차단하고 continue를 지시합니다.
"""
import sys
import os
import json
import subprocess

def main():
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input) if raw_input.strip() else {}
        reason = payload.get("terminationReason", "")

        # 사용자가 취소한 경우는 차단하지 않음
        if reason in ("USER_CANCELED", "TERMINAL_CUSTOM_HOOK"):
            print(json.dumps({"decision": "allow"}))
            return

        # 레포 루트 경로 탐색
        repo_root = "/home/rokey/ticket_koreatech"
        current_dir = os.path.dirname(os.path.abspath(__file__))
        p = current_dir
        while p != "/" and not os.path.exists(os.path.join(p, ".jev", "rubric.md")):
            p = os.path.dirname(p)
        if os.path.exists(os.path.join(p, ".jev", "rubric.md")):
            repo_root = p

        # jev 실행
        res = subprocess.run(["jev"], cwd=repo_root, capture_output=True, text=True)
        if res.returncode == 0:
            print(json.dumps({"decision": "allow"}))
        else:
            output_msg = res.stdout.strip() or res.stderr.strip() or "[FAIL] 루브릭 검증 실패"
            result = {
                "decision": "continue",
                "reason": (
                    f"TypeSafe jev 판정형 품질 게이트 미달로 작업 완료가 차단되었습니다.\n"
                    f"{output_msg}\n"
                    f".jev/rubric.md의 기획 조항들을 만족하도록 비즈니스 로직을 보완하십시오."
                )
            }
            print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        sys.stderr.write(f"jev stop hook error: {e}\n")
        print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    main()
