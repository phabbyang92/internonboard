import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import type { AttachmentType, StudentForm } from "@/types/student";
import type { ReactNode } from "react";

const attachmentLabels: Record<AttachmentType, string> = {
  resume: "个人简历",
  id_card_front: "身份证正面（或外籍护照首页）",
  id_card_back: "身份证反面（或外籍护照签证页）",
};

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function ReadonlyItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-[#e1e8ef] pb-3">
      <dt className="text-xs font-medium text-[#6b7f92]">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-[#2b3e50]">
        {children}
      </dd>
    </div>
  );
}

function ReadonlySection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
      <header className="border-b border-[#d2dee8] px-5 py-5 sm:px-8">
        <p className="text-xs font-semibold text-[#184268]">{number}</p>
        <h2 className="mt-2 text-lg font-semibold text-[#223548]">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function EmptyContent({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-sm text-[#6b7f92] sm:px-8">{children}</p>;
}

export function StudentSubmittedForm({ form }: { form: StudentForm }) {
  const basic = form.basicInfo;

  return (
    <div className="mt-8 space-y-6">
      <ReadonlySection number="01" title="个人信息">
        {basic ? (
          <dl className="grid gap-x-6 gap-y-4 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
            <ReadonlyItem label="姓名">{form.name}</ReadonlyItem>
            <ReadonlyItem label="邮箱">{form.email}</ReadonlyItem>
            <ReadonlyItem label="联系电话">{display(form.phone)}</ReadonlyItem>
            <ReadonlyItem label="申请职位">{display(basic.position)}</ReadonlyItem>
            <ReadonlyItem label="投递方向">{display(basic.applicationDirection)}</ReadonlyItem>
            <ReadonlyItem label="投递渠道">{display(basic.sourceChannel)}</ReadonlyItem>
            <ReadonlyItem label="性别">{display(basic.gender)}</ReadonlyItem>
            <ReadonlyItem label="出生日期">{formatDateOnly(basic.birthDate)}</ReadonlyItem>
            <ReadonlyItem label="身份证号码（或外籍护照号）">
              {display(basic.idNumber)}
            </ReadonlyItem>
            <ReadonlyItem label="户籍">{display(basic.householdRegistration)}</ReadonlyItem>
            <ReadonlyItem label="婚姻状况">{display(basic.maritalStatus)}</ReadonlyItem>
            <ReadonlyItem label="学历">{display(basic.degree)}</ReadonlyItem>
            <ReadonlyItem label="在读学校">{display(basic.currentSchool)}</ReadonlyItem>
            <ReadonlyItem label="专业">{display(basic.major)}</ReadonlyItem>
            <ReadonlyItem label="政治面貌">{display(basic.politicalStatus)}</ReadonlyItem>
            <ReadonlyItem label="家庭电话">{display(basic.homePhone)}</ReadonlyItem>
            <ReadonlyItem label="家庭地址">{display(basic.homeAddress)}</ReadonlyItem>
          </dl>
        ) : (
          <EmptyContent>未读取到个人信息。</EmptyContent>
        )}
      </ReadonlySection>

      <ReadonlySection number="02" title="教育经历">
        {form.educationExperiences.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f7fa] text-xs text-[#52677a]">
                <tr>
                  <th className="px-5 py-3 sm:px-8">起始年份</th>
                  <th className="px-4 py-3">结束年份</th>
                  <th className="px-4 py-3">学校</th>
                  <th className="px-4 py-3">专业</th>
                  <th className="px-4 py-3">班主任 / 导师</th>
                  <th className="px-5 py-3 sm:px-8">联系电话</th>
                </tr>
              </thead>
              <tbody>
                {form.educationExperiences.map((item, index) => (
                  <tr key={`${item.school}-${index}`} className="border-t border-[#e1e8ef]">
                    <td className="px-5 py-4 sm:px-8">{item.startYear}</td>
                    <td className="px-4 py-4">{item.endYear}</td>
                    <td className="px-4 py-4 font-medium">{item.school}</td>
                    <td className="px-4 py-4">{item.major}</td>
                    <td className="px-4 py-4">{display(item.advisor)}</td>
                    <td className="px-5 py-4 sm:px-8">{display(item.phone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyContent>未填写教育经历。</EmptyContent>
        )}
      </ReadonlySection>

      <ReadonlySection number="03" title="家庭成员">
        {form.familyMembers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f7fa] text-xs text-[#52677a]">
                <tr>
                  <th className="px-5 py-3 sm:px-8">关系</th>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3">工作单位</th>
                  <th className="px-5 py-3 sm:px-8">联系电话</th>
                </tr>
              </thead>
              <tbody>
                {form.familyMembers.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t border-[#e1e8ef]">
                    <td className="px-5 py-4 sm:px-8">{item.relation}</td>
                    <td className="px-4 py-4 font-medium">{item.name}</td>
                    <td className="px-4 py-4">{display(item.employer)}</td>
                    <td className="px-5 py-4 sm:px-8">{display(item.phone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyContent>未填写家庭成员。</EmptyContent>
        )}
      </ReadonlySection>

      <ReadonlySection number="04" title="校外实习或兼职经历">
        {form.internshipExperiences.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f7fa] text-xs text-[#52677a]">
                <tr>
                  <th className="px-5 py-3 sm:px-8">起始年份</th>
                  <th className="px-4 py-3">结束年份</th>
                  <th className="px-4 py-3">实习公司</th>
                  <th className="px-4 py-3">证明人</th>
                  <th className="px-5 py-3 sm:px-8">联系电话</th>
                </tr>
              </thead>
              <tbody>
                {form.internshipExperiences.map((item, index) => (
                  <tr key={`${item.company}-${index}`} className="border-t border-[#e1e8ef]">
                    <td className="px-5 py-4 sm:px-8">{item.startYear}</td>
                    <td className="px-4 py-4">{item.endYear}</td>
                    <td className="px-4 py-4 font-medium">{item.company}</td>
                    <td className="px-4 py-4">{display(item.referenceName)}</td>
                    <td className="px-5 py-4 sm:px-8">{display(item.phone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyContent>未填写校外实习或兼职经历。</EmptyContent>
        )}
      </ReadonlySection>

      <ReadonlySection number="05" title="补充信息">
        <dl className="grid gap-x-6 gap-y-4 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          <ReadonlyItem label="工作地点">{display(form.workLocation)}</ReadonlyItem>
          <ReadonlyItem label="入职开始日期">{formatDateOnly(form.onboardingStartAt)}</ReadonlyItem>
          <ReadonlyItem label="实习结束日期">{formatDateOnly(form.onboardingEndAt)}</ReadonlyItem>
          <ReadonlyItem label="紧急联系人姓名">{display(form.emergencyContactName)}</ReadonlyItem>
          <ReadonlyItem label="紧急联系人电话">{display(form.emergencyContactPhone)}</ReadonlyItem>
          <ReadonlyItem label="与紧急联系人的关系">{display(form.emergencyContactRelation)}</ReadonlyItem>
          <ReadonlyItem label="身份证件材料和服务协议是否齐全">
            {form.hasIdCopyAndAgreement === null
              ? "未填写"
              : form.hasIdCopyAndAgreement
                ? "是"
                : "否"}
          </ReadonlyItem>
          <ReadonlyItem label="其他需要补充说明的情况">{display(form.notes)}</ReadonlyItem>
        </dl>
      </ReadonlySection>

      <ReadonlySection number="06" title="申请人签署">
        <dl className="grid gap-x-6 gap-y-4 px-5 py-6 sm:grid-cols-2 sm:px-8">
          <ReadonlyItem label="申请人签名">{display(form.applicantSignature)}</ReadonlyItem>
          <ReadonlyItem label="签署日期">{formatDateOnly(form.applicantSignedAt)}</ReadonlyItem>
        </dl>
      </ReadonlySection>

      <ReadonlySection number="07" title="附件资料">
        {form.attachments.length ? (
          <ul className="divide-y divide-[#e1e8ef]">
            {form.attachments.map((attachment) => (
              <li key={attachment.storageKey} className="px-5 py-4 sm:px-8">
                <p className="text-xs font-medium text-[#6b7f92]">
                  {attachmentLabels[attachment.type]}
                </p>
                <p className="mt-1.5 break-all text-sm font-medium text-[#2b3e50]">
                  {attachment.originalName}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyContent>未读取到附件资料。</EmptyContent>
        )}
      </ReadonlySection>

      <div className="rounded-lg border border-[#c8d6e1] bg-[#edf4fa] px-5 py-4 text-sm text-[#425a6e] sm:px-8">
        登记提交时间：<span className="font-medium text-[#243648]">{formatDateTime(form.submittedAt)}</span>
      </div>
    </div>
  );
}
