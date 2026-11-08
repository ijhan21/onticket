"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AdminAuthContextType {
  adminPassword: string;
  setAdminPassword: (password: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
  undefined
);

/**
 * 운영 비밀번호 메모리 보관소
 * 주의: 보안 요구사항에 따라 localStorage, sessionStorage, 쿠키, URL 쿼리스트링에 절대 저장하지 않고
 * 오직 React 런타임 메모리(useState)에만 유지합니다.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminPassword, setAdminPasswordState] = useState<string>("");
  const router = useRouter();

  const setAdminPassword = (password: string) => {
    setAdminPasswordState(password);
  };

  const logout = () => {
    setAdminPasswordState("");
    router.push("/admin/login");
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminPassword,
        setAdminPassword,
        logout,
        isAuthenticated: !!adminPassword,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
