"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { HrArrangementCard } from "@/components/hr/hr-arrangement-card";
import { HrAttachmentManager } from "@/components/hr/hr-attachment-manager";
import { HrModal } from "@/components/hr/hr-modal";
import { OnboardingStatusBadge } from "@/components/hr/onboarding-status-badge";
import { HrStudentProfileEditor } from "@/components/hr/hr-student-profile-editor";
import { HrStudentActivity } from "@/components/hr/hr-student-activity";
import { ApiError } from "@/lib/api/client";
import { getHrStudent } from "@/lib/api/hr-students";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import type { HrStudentDetail as HrStudentDetailType } from "@/types/hr";

interface Props {
  studentId: string;
}

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[#e3e9e7] pb-3">
      <dt className="text-xs font-medium text-[#75817d]">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-[#2c3b37]">
        {children}
      </dd>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-[#d3ddda] bg-white">
      <header className="border-b border-[#d8e0dd] px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-[#22322d]">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-[#75817d]">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function EmptySection({ message }: { message: string }) {
  return <p className="px-5 py-8 text-sm text-[#75817d] sm:px-6">{message}</p>;
}

export function HrStudentDetail({ studentId }: Props) {
  const router = useRouter();
  const [student, setStudent] = useState<HrStudentDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    void getHrStudent(studentId)
      .then((result) => {
        if (isActive) setStudent(result);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        if (error instanceof ApiError && error.statusCode === 401) {
          router.replace("/hr/login");
          return;
        }
        setErrorMessage(
          error instanceof ApiError ? error.message : "无法读取学生详情",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [refreshKey, router, studentId]);

  function reload() {
    setIsLoading(true);
    setErrorMessage("");
    setRefreshKey((current) => current + 1);
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 text-center text-sm text-[#66736f] sm:px-8">
        正在加载学生详情...
      </main>
    );
  }

  if (errorMessage || !student) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8">
        <p className="text-sm text-[#9d3426]" role="alert">
          {errorMessage || "学生不存在"}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/hr/students" className="border border-[#bdcac6] px-4 py-2 text-sm">
            返回列表
          </Link>
          <button type="button" onClick={reload} className="bg-[#147565] px-4 py-2 text-sm font-medium text-white">
            重新加载
          </button>
        </div>
      </main>
    );
  }

  const basic = student.basicInfo;

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <Link href="/hr/students" className="text-sm font-medium text-[#147565] hover:underline">
        返回学生列表
      </Link>

      <div className="mt-5 flex flex-col gap-4 border-b border-[#cdd8d4] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-[#17221f]">{student.name}</h1>
            <OnboardingStatusBadge status={student.onboardingStatus} />
          </div>
          <p className="mt-2 break-all text-sm text-[#66736f]">{student.email} · {display(student.phone)}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="text-left text-xs text-[#66736f] sm:text-right">
            <p>登记提交时间（填表日期）</p>
            <p className="mt-1 text-sm font-medium text-[#35453f]">{student.submittedAt ? formatDateTime(student.submittedAt) : "尚未提交"}</p>
          </div>
          <button type="button" onClick={() => { setSuccessMessage(""); setIsProfileEditing(true); }} className="min-h-10 bg-[#147565] px-4 text-sm font-semibold text-white hover:bg-[#0f6255]">
            修改登记信息
          </button>
        </div>
      </div>

      {successMessage ? (
        <p className="mt-5 border border-[#a9c9c1] bg-[#edf7f4] px-4 py-3 text-sm text-[#175e51]" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section title="个人情况" description="姓名和邮箱来自 HR 预录入；其余内容来自学生登记表。">
            {basic ? (
              <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                <DetailItem label="申请职位">{display(basic.position)}</DetailItem>
                <DetailItem label="投递方向">{display(basic.applicationDirection)}</DetailItem>
                <DetailItem label="性别">{display(basic.gender)}</DetailItem>
                <DetailItem label="出生日期">{formatDateOnly(basic.birthDate)}</DetailItem>
                <DetailItem label="身份证号">{display(basic.idNumber)}</DetailItem>
                <DetailItem label="户籍">{display(basic.householdRegistration)}</DetailItem>
                <DetailItem label="婚姻状况">{display(basic.maritalStatus)}</DetailItem>
                <DetailItem label="当前学校">{display(basic.currentSchool)}</DetailItem>
                <DetailItem label="专业">{display(basic.major)}</DetailItem>
                <DetailItem label="学历">{display(basic.degree)}</DetailItem>
                <DetailItem label="政治面貌">{display(basic.politicalStatus)}</DetailItem>
                <DetailItem label="投递渠道">{display(basic.sourceChannel)}</DetailItem>
                <DetailItem label="家庭地址">{display(basic.homeAddress)}</DetailItem>
                <DetailItem label="家庭电话">{display(basic.homePhone)}</DetailItem>
              </dl>
            ) : (
              <EmptySection message="学生尚未填写个人信息。" />
            )}
          </Section>

          <Section title="教育经历">
            {student.educationExperiences.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead className="bg-[#f4f7f6] text-xs text-[#52615d]"><tr><th className="px-5 py-3">起始年</th><th className="px-4 py-3">结束年</th><th className="px-4 py-3">学校</th><th className="px-4 py-3">专业</th><th className="px-4 py-3">导师/班主任</th><th className="px-5 py-3">联系电话</th></tr></thead>
                  <tbody>{student.educationExperiences.map((item, index) => <tr key={`${item.school}-${index}`} className="border-t border-[#e3e9e7]"><td className="px-5 py-3">{item.startYear}</td><td className="px-4 py-3">{item.endYear}</td><td className="px-4 py-3 font-medium">{item.school}</td><td className="px-4 py-3">{item.major}</td><td className="px-4 py-3">{display(item.advisor)}</td><td className="px-5 py-3">{display(item.phone)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <EmptySection message="暂无教育经历。" />}
          </Section>

          <Section title="家庭成员">
            {student.familyMembers.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead className="bg-[#f4f7f6] text-xs text-[#52615d]"><tr><th className="px-5 py-3">关系</th><th className="px-4 py-3">姓名</th><th className="px-4 py-3">工作单位</th><th className="px-5 py-3">联系电话</th></tr></thead><tbody>{student.familyMembers.map((item, index) => <tr key={`${item.name}-${index}`} className="border-t border-[#e3e9e7]"><td className="px-5 py-3">{item.relation}</td><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{display(item.employer)}</td><td className="px-5 py-3">{display(item.phone)}</td></tr>)}</tbody></table></div>
            ) : <EmptySection message="暂无家庭成员信息。" />}
          </Section>

          <Section title="校外实习或兼职经历">
            {student.internshipExperiences.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead className="bg-[#f4f7f6] text-xs text-[#52615d]"><tr><th className="px-5 py-3">起始年</th><th className="px-4 py-3">结束年</th><th className="px-4 py-3">公司</th><th className="px-4 py-3">证明人</th><th className="px-5 py-3">联系电话</th></tr></thead><tbody>{student.internshipExperiences.map((item, index) => <tr key={`${item.company}-${index}`} className="border-t border-[#e3e9e7]"><td className="px-5 py-3">{item.startYear}</td><td className="px-4 py-3">{item.endYear}</td><td className="px-4 py-3 font-medium">{item.company}</td><td className="px-4 py-3">{display(item.referenceName)}</td><td className="px-5 py-3">{display(item.phone)}</td></tr>)}</tbody></table></div>
            ) : <EmptySection message="暂无校外实习或兼职经历。" />}
          </Section>

          <Section title="补充信息">
            <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
              <DetailItem label="紧急联系人">{display(student.emergencyContactName)}</DetailItem>
              <DetailItem label="紧急联系电话">{display(student.emergencyContactPhone)}</DetailItem>
              <DetailItem label="关系">{display(student.emergencyContactRelation)}</DetailItem>
              <DetailItem label="身份证复印件和协议">{student.hasIdCopyAndAgreement === null ? "未填写" : student.hasIdCopyAndAgreement ? "是" : "否"}</DetailItem>
              <DetailItem label="协议签署日期">{formatDateOnly(student.agreementSignedAt)}</DetailItem>
              <DetailItem label="申请人签名">{display(student.applicantSignature)}</DetailItem>
              <DetailItem label="申请人签署日期">{formatDateOnly(student.applicantSignedAt)}</DetailItem>
              <DetailItem label="其他说明">{display(student.notes)}</DetailItem>
            </dl>
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-5">
          <HrArrangementCard student={student} onSaved={reload} />

          <HrAttachmentManager student={student} onChanged={reload} />

          <Section title="记录信息">
            <dl className="grid gap-4 px-5 py-5">
              <DetailItem label="系统创建时间">{formatDateTime(student.createdAt)}</DetailItem>
              <DetailItem label="最后更新时间">{formatDateTime(student.updatedAt)}</DetailItem>
              <DetailItem label="学生提交状态">{student.hasSubmitted ? "已提交，仅 HR 可修改" : "未提交"}</DetailItem>
            </dl>
          </Section>
        </aside>
      </div>

      <HrStudentActivity
        studentId={student.id}
        studentName={student.name}
        refreshToken={student.updatedAt}
      />

      <HrModal
        isOpen={isProfileEditing}
        onClose={() => setIsProfileEditing(false)}
        title={`修改 ${student.name} 的登记信息`}
        description="HR 的修改不受学生一次性提交限制，保存后会记录本次操作。"
        wide
      >
        <HrStudentProfileEditor
          key={student.updatedAt}
          student={student}
          onCancel={() => setIsProfileEditing(false)}
          onSaved={(updatedStudent) => {
            setStudent(updatedStudent);
            setIsProfileEditing(false);
            setSuccessMessage("登记信息已保存");
          }}
        />
      </HrModal>
    </main>
  );
}
