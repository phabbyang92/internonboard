"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { getCurrentHr, loginHr } from "@/lib/api/hr-auth";

export default function HrLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    void getCurrentHr()
      .then(() => {
        if (isActive) {
          router.replace("/hr/students");
        }
      })
      .catch(() => {
        // Missing or expired HR Cookie is expected on the login page.
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("请填写邮箱和密码");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await loginHr({ email: normalizedEmail, password });
      router.replace("/hr/students");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "登录失败，请稍后重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f7fa] px-6">
        <p className="text-sm text-[#52677a]" role="status">
          正在确认登录状态...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] text-[#172735]">
      <header className="border-b border-[#d5e0e9] bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center px-5 sm:px-8">
          <span className="text-sm font-semibold text-[#30475b]">
            学生入职管理系统
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-20">
        <div className="max-w-xl pt-2 lg:pt-10">
          <p className="text-sm font-semibold text-[#184268]">HR 后台</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            学生信息管理
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#52677a]">
            登录后查看学生登记资料、入职安排和附件信息。
          </p>

          <dl className="mt-10 grid gap-5 border-l-2 border-[#4f88b7] pl-5 text-sm">
            <div>
              <dt className="font-medium text-[#263a4b]">学生管理</dt>
              <dd className="mt-1 text-[#5f7285]">搜索、筛选并查看学生状态</dd>
            </div>
            <div>
              <dt className="font-medium text-[#263a4b]">权限保护</dt>
              <dd className="mt-1 text-[#5f7285]">后台页面仅限已登录 HR 访问</dd>
            </div>
          </dl>
        </div>

        <form
          className="rounded-lg border border-[#d2dee8] bg-white p-6 shadow-[0_12px_35px_rgba(24,66,104,0.09)] sm:p-8"
          onSubmit={handleSubmit}
        >
          <h2 className="text-xl font-semibold">HR 登录</h2>
          <p className="mt-2 text-sm text-[#5f7285]">使用公司 HR 账号进入后台</p>

          <div className="mt-7 space-y-5">
            <div>
              <label className="text-sm font-medium" htmlFor="hr-email">
                邮箱
              </label>
              <input
                id="hr-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 text-base outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="hr-password">
                密码
              </label>
              <input
                id="hr-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full border border-[#b9c9d7] px-3 text-base outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
              />
            </div>
          </div>

          {errorMessage ? (
            <p
              className="mt-5 border-l-2 border-[#c94f3d] bg-[#fff5f2] px-3 py-2 text-sm text-[#9d3426]"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-7 h-11 w-full bg-[#184268] px-4 text-sm font-semibold text-white transition hover:bg-[#123653] focus:outline-none focus:ring-2 focus:ring-[#184268] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#8ea8bc]"
          >
            {isSubmitting ? "正在登录..." : "登录 HR 后台"}
          </button>
        </form>
      </section>
    </main>
  );
}
