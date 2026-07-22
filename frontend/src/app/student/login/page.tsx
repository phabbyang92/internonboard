"use client";

import { ApiError } from "@/lib/api/client";
import { getCurrentStudent, loginStudent } from "@/lib/api/student-auth";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

function getStudentDestination(hasSubmitted: boolean): string {
  return hasSubmitted ? "/student/submitted" : "/student/form";
}

export default function StudentLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    void getCurrentStudent()
      .then(({ student }) => {
        if (isActive) {
          router.replace(getStudentDestination(student.hasSubmitted));
        }
      })
      .catch(() => {
        // A missing/expired Cookie is the normal state on the login page.
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

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail) {
      setErrorMessage("请填写姓名和邮箱");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { student } = await loginStudent({
        name: normalizedName,
        email: normalizedEmail,
      });

      router.replace(getStudentDestination(student.hasSubmitted));
    } catch (error: unknown) {
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
    <main className="min-h-screen bg-[#f3f7fa] text-[#172735]">
      <header className="border-b border-[#d5e0e9] bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center px-5 sm:px-8">
          <span className="text-sm font-semibold text-[#30475b]">
            学生入职登记系统
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-20">
        <div className="max-w-xl pt-2 lg:pt-10">
          <p className="text-sm font-semibold text-[#184268]">学生入口</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            学生入职登记
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#52677a]">
            请使用 HR 预录入的姓名和邮箱进入登记系统。
          </p>

          <dl className="mt-10 grid gap-5 border-l-2 border-[#4f88b7] pl-5 text-sm">
            <div>
              <dt className="font-medium text-[#263a4b]">登录信息</dt>
              <dd className="mt-1 text-[#5f7285]">姓名与邮箱需和入职名单一致</dd>
            </div>
            <div>
              <dt className="font-medium text-[#263a4b]">提交规则</dt>
              <dd className="mt-1 text-[#5f7285]">登记表确认后只能提交一次</dd>
            </div>
          </dl>
        </div>

        <form
          className="rounded-lg border border-[#d2dee8] bg-white p-6 shadow-[0_12px_35px_rgba(24,66,104,0.09)] sm:p-8"
          onSubmit={handleSubmit}
          noValidate
        >
          <div>
            <h2 className="text-xl font-semibold">登录</h2>
            <p className="mt-2 text-sm text-[#5f7285]">进入你的入职登记表</p>
          </div>

          <div className="mt-7 space-y-5">
            <div>
              <label className="text-sm font-medium" htmlFor="student-name">
                姓名
              </label>
              <input
                id="student-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full border border-[#b9c9d7] bg-white px-3 text-base outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
                placeholder="请输入姓名"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="student-email">
                邮箱
              </label>
              <input
                id="student-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full border border-[#b9c9d7] bg-white px-3 text-base outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
                placeholder="name@example.com"
                required
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
            {isSubmitting ? "正在登录..." : "进入登记系统"}
          </button>
        </form>
      </section>
    </main>
  );
}
