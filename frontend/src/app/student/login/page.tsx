"use client";

import { ApiError } from "@/lib/api/client";
import { getStudentPortal } from "@/lib/api/student-attendance";
import { loginStudent } from "@/lib/api/student-auth";
import { getStudentPortalPath } from "@/lib/student-portal-routing";
import { isStudentSessionExpiredReason } from "@/lib/student-session";
import { Steps } from "antd";
import { CalendarClock, ClipboardCheck, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const STUDENT_WORKFLOW_STEPS = [
  {
    number: "01",
    stage: "入职前",
    title: "填写登记表",
    description: "完善个人信息并上传所需附件，核对无误后提交。",
    icon: ClipboardCheck,
  },
  {
    number: "02",
    stage: "等待入职",
    title: "留意入职安排",
    description: "登记完成后，按照 HR 安排等待入职日期。",
    icon: CalendarClock,
  },
  {
    number: "03",
    stage: "入职后",
    title: "完成每日考勤",
    description: "工作日登记出勤；如需请假，提交请假申请。",
    icon: UserCheck,
  },
] as const;

export default function StudentLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;
    const sessionExpired = isStudentSessionExpiredReason(
      new URLSearchParams(window.location.search).get("reason"),
    );

    void getStudentPortal()
      .then((portal) => {
        if (isActive) {
          router.replace(getStudentPortalPath(portal.portalState));
        }
      })
      .catch(() => {
        // A missing/expired Cookie is the normal state on the login page.
        if (isActive && sessionExpired) {
          setErrorMessage("登录已过期，请重新输入姓名和邮箱进入系统。");
        }
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
      await loginStudent({
        name: normalizedName,
        email: normalizedEmail,
      });
      const portal = await getStudentPortal();

      router.replace(getStudentPortalPath(portal.portalState));
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
        <div className="mx-auto flex min-h-16 max-w-7xl items-center px-5 sm:px-8">
          <span className="text-sm font-semibold text-[#30475b]">
            登记与考勤系统
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-start gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-20">
        <div className="min-w-0 pt-2 lg:pt-8">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            登记与考勤工作台
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#52677a]">
            请使用 HR 预录入的姓名和邮箱进入登记系统。
          </p>

          <div
            className="mt-11 rounded-lg border border-[#cbd9e4] bg-white px-5 py-7 shadow-[0_10px_30px_rgba(24,66,104,0.07)] sm:px-7 sm:py-8"
            aria-label="学生登记与考勤流程"
          >
            <Steps
              className="student-workflow-steps"
              current={-1}
              titlePlacement="vertical"
              responsive
              items={STUDENT_WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon;

                return {
                  status: "process",
                  icon: (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#184268] text-white shadow-[0_6px_16px_rgba(24,66,104,0.2)]">
                      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  ),
                  title: (
                    <span className="block">
                      <span className="block text-xs font-semibold text-[#52708a]">
                        STEP {step.number} · {step.stage}
                      </span>
                      <span className="mt-1 block text-base font-semibold text-[#203446]">
                        {step.title}
                      </span>
                    </span>
                  ),
                  content: (
                    <span className="mx-auto mt-2 block max-w-48 text-sm leading-6 text-[#637789]">
                      {step.description}
                    </span>
                  ),
                };
              })}
            />
          </div>
        </div>

        <form
          className="rounded-lg border border-[#d2dee8] bg-white p-6 shadow-[0_12px_35px_rgba(24,66,104,0.09)] sm:p-8"
          onSubmit={handleSubmit}
          noValidate
        >
          <div>
            <h2 className="text-xl font-semibold">登录</h2>
            <p className="mt-2 text-sm text-[#5f7285]">
              进入你的登记与考勤工作台
            </p>
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
            {isSubmitting ? "正在登录..." : "进入工作台"}
          </button>
        </form>
      </section>
    </main>
  );
}
