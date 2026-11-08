"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icons";
import { fetchAdminEvents } from "@/lib/api-client/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminPassword } = useAdminAuth();

  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 서버 판정: GET /admin/events 호출하여 비밀번호 검증 (3.2절, AC39)
      await fetchAdminEvents(password);

      // 메모리에만 비밀번호 저장 (브라우저 저장소·쿠키·URL에는 저장하지 않음)
      setAdminPassword(password);

      // S07 공연 현황으로 이동
      router.push("/admin/events");
    } catch {
      // 틀림: 칸을 비우고 오류 문구 노출 (AC41, S06-T4)
      setPassword("");
      setErrorMessage("비밀번호가 맞지 않아요. 다시 입력해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="w-full max-w-[var(--layout-mobile)] mx-auto min-h-screen bg-bg border-x border-border flex flex-col"
      aria-label="S06 운영 비밀번호 확인"
    >
      <header className="flex items-center justify-between min-h-[var(--tap-target)] px-4 py-2 border-b border-border">
        <div className="flex items-baseline gap-3">
          <span className="wordmark">
            온티켓<span className="wordmark-dot">.</span>
          </span>
          <span className="text-caption text-text-muted">운영 서비스</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 flex-1 justify-center" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="pw" className="text-caption text-text-muted font-medium">
            운영팀 비밀번호
          </label>
          <div className="relative flex">
            <input
              id="pw"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
              className={`w-full min-h-[var(--tap-target)] pl-3 pr-11 bg-surface text-text border ${
                errorMessage ? "border-error" : "border-border-strong"
              } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "비밀번호 가리기" : "비밀번호 보기"}
              className="absolute right-0 top-0 w-[var(--tap-target)] h-[var(--tap-target)] flex items-center justify-center bg-transparent border-0 text-text-muted cursor-pointer"
            >
              {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
          {errorMessage && (
            <p className="text-caption text-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!password || isLoading}
          className="inline-flex items-center justify-center min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium transition-colors hover:bg-surface-3 disabled:bg-surface disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="spinner" aria-label="기다리는 중" />
          ) : (
            "들어가기"
          )}
        </button>
      </form>
    </main>
  );
}
