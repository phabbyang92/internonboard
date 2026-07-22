"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { DatePickerInput } from "@/components/ui/date-picker-input";
import { ApiError } from "@/lib/api/client";
import { updateHrStudentProfile } from "@/lib/api/hr-students";
import { createStudentFormDraft } from "@/types/student-form-draft";
import type { HrStudentDetail, UpdateHrProfilePayload } from "@/types/hr";
import { APPLICATION_DIRECTIONS, type StudentBasicInfo } from "@/types/student";

interface Props {
  student: HrStudentDetail;
  onSaved: (student: HrStudentDetail) => void;
  onCancel: () => void;
}

const inputClass = "mt-1.5 h-10 w-full border border-[#b9c9d7] bg-white px-3 text-sm outline-none focus:border-[#184268]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-[#52677a]">{label}{children}</label>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#d5e0e9] pt-5 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-[#263a4b]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HrStudentProfileEditor({ student, onSaved, onCancel }: Props) {
  const initial = createStudentFormDraft(student);
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateBasic(field: keyof typeof draft.basicInfo, value: string) {
    setDraft((current) => ({ ...current, basicInfo: { ...current.basicInfo, [field]: value } }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const basicInfo = Object.fromEntries(
      Object.entries(draft.basicInfo).filter(
        ([, value]) => student.basicInfo !== null || value !== "",
      ),
    ) as Partial<StudentBasicInfo>;

    const payload: UpdateHrProfilePayload = {
      name,
      email,
      ...(draft.phone.trim() ? { phone: draft.phone } : {}),
      ...(Object.keys(basicInfo).length ? { basicInfo } : {}),
      educationExperiences: draft.educationExperiences.map((item) => ({
        ...item,
        startYear: Number(item.startYear),
        endYear: Number(item.endYear),
        advisor: item.advisor || undefined,
        phone: item.phone || undefined,
      })),
      familyMembers: draft.familyMembers.map((item) => ({
        ...item,
        employer: item.employer || undefined,
        phone: item.phone || undefined,
      })),
      internshipExperiences: draft.internshipExperiences.map((item) => ({
        ...item,
        startYear: Number(item.startYear),
        endYear: Number(item.endYear),
        referenceName: item.referenceName || undefined,
        phone: item.phone || undefined,
      })),
      ...(draft.emergencyContactName.trim()
        ? { emergencyContactName: draft.emergencyContactName }
        : {}),
      ...(draft.emergencyContactPhone.trim()
        ? { emergencyContactPhone: draft.emergencyContactPhone }
        : {}),
      ...(draft.emergencyContactRelation.trim()
        ? { emergencyContactRelation: draft.emergencyContactRelation }
        : {}),
      ...(draft.hasIdCopyAndAgreement !== null ? { hasIdCopyAndAgreement: draft.hasIdCopyAndAgreement } : {}),
      notes: draft.notes,
      ...(draft.applicantSignature.trim()
        ? { applicantSignature: draft.applicantSignature }
        : {}),
      ...(draft.applicantSignedAt
        ? { applicantSignedAt: draft.applicantSignedAt }
        : student.applicantSignedAt
          ? { applicantSignedAt: null }
          : {}),
    };

    try {
      onSaved(await updateHrStudentProfile(student.id, payload));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "保存登记信息失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6 px-5 py-5 sm:px-6" onSubmit={submit}>
      <Section title="登录与联系信息">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="姓名"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
          <Field label="邮箱"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
          <Field label="联系电话"><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="个人情况">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="申请职位"><input value={draft.basicInfo.position} onChange={(e) => updateBasic("position", e.target.value)} className={inputClass} /></Field>
          <Field label="投递方向"><select value={draft.basicInfo.applicationDirection} onChange={(e) => updateBasic("applicationDirection", e.target.value)} className={inputClass}><option value="">未填写</option>{APPLICATION_DIRECTIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="性别"><input value={draft.basicInfo.gender} onChange={(e) => updateBasic("gender", e.target.value)} className={inputClass} /></Field>
          <Field label="出生日期"><DatePickerInput value={draft.basicInfo.birthDate} onChange={(e) => updateBasic("birthDate", e.target.value)} className={inputClass} /></Field>
          <Field label="身份证号码（或外籍护照号）"><input value={draft.basicInfo.idNumber} onChange={(e) => updateBasic("idNumber", e.target.value)} className={inputClass} /></Field>
          <Field label="户籍"><input value={draft.basicInfo.householdRegistration} onChange={(e) => updateBasic("householdRegistration", e.target.value)} className={inputClass} /></Field>
          <Field label="婚姻状况"><input value={draft.basicInfo.maritalStatus} onChange={(e) => updateBasic("maritalStatus", e.target.value)} className={inputClass} /></Field>
          <Field label="当前学校"><input value={draft.basicInfo.currentSchool} onChange={(e) => updateBasic("currentSchool", e.target.value)} className={inputClass} /></Field>
          <Field label="专业"><input value={draft.basicInfo.major} onChange={(e) => updateBasic("major", e.target.value)} className={inputClass} /></Field>
          <Field label="学历"><input value={draft.basicInfo.degree} onChange={(e) => updateBasic("degree", e.target.value)} className={inputClass} /></Field>
          <Field label="政治面貌"><input value={draft.basicInfo.politicalStatus} onChange={(e) => updateBasic("politicalStatus", e.target.value)} className={inputClass} /></Field>
          <Field label="投递渠道"><input value={draft.basicInfo.sourceChannel} onChange={(e) => updateBasic("sourceChannel", e.target.value)} className={inputClass} /></Field>
          <Field label="家庭地址"><input value={draft.basicInfo.homeAddress} onChange={(e) => updateBasic("homeAddress", e.target.value)} className={inputClass} /></Field>
          <Field label="家庭电话"><input value={draft.basicInfo.homePhone} onChange={(e) => updateBasic("homePhone", e.target.value)} className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="教育经历" action={<button type="button" onClick={() => setDraft({ ...draft, educationExperiences: [...draft.educationExperiences, { startYear: "", endYear: "", school: "", major: "", advisor: "", phone: "" }] })} className="text-sm font-medium text-[#184268]">添加经历</button>}>
        <div className="space-y-3">
          {draft.educationExperiences.map((item, index) => (
            <div key={index} className="grid gap-3 border border-[#d5e0e9] p-3 sm:grid-cols-3">
              {(["startYear", "endYear", "school", "major", "advisor", "phone"] as const).map((field) => <Field key={field} label={({ startYear: "起始年", endYear: "结束年", school: "学校", major: "专业", advisor: "导师/班主任", phone: "联系电话" } as const)[field]}><input required={["startYear", "endYear", "school", "major"].includes(field)} type={field.includes("Year") ? "number" : "text"} value={item[field]} onChange={(e) => setDraft((current) => ({ ...current, educationExperiences: current.educationExperiences.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: e.target.value } : row) }))} className={inputClass} /></Field>)}
              <button type="button" onClick={() => setDraft({ ...draft, educationExperiences: draft.educationExperiences.filter((_, rowIndex) => rowIndex !== index) })} className="justify-self-start text-sm text-[#9d3426]">删除这条</button>
            </div>
          ))}
          {!draft.educationExperiences.length ? <p className="text-sm text-[#6b7f92]">暂无教育经历</p> : null}
        </div>
      </Section>

      <Section title="家庭成员" action={<button type="button" onClick={() => setDraft({ ...draft, familyMembers: [...draft.familyMembers, { relation: "", name: "", employer: "", phone: "" }] })} className="text-sm font-medium text-[#184268]">添加成员</button>}>
        <div className="space-y-3">
          {draft.familyMembers.map((item, index) => (
            <div key={index} className="grid gap-3 border border-[#d5e0e9] p-3 sm:grid-cols-4">
              {(["relation", "name", "employer", "phone"] as const).map((field) => <Field key={field} label={({ relation: "关系", name: "姓名", employer: "工作单位", phone: "联系电话" } as const)[field]}><input required={field === "relation" || field === "name"} value={item[field]} onChange={(e) => setDraft((current) => ({ ...current, familyMembers: current.familyMembers.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: e.target.value } : row) }))} className={inputClass} /></Field>)}
              <button type="button" onClick={() => setDraft({ ...draft, familyMembers: draft.familyMembers.filter((_, rowIndex) => rowIndex !== index) })} className="justify-self-start text-sm text-[#9d3426]">删除这条</button>
            </div>
          ))}
          {!draft.familyMembers.length ? <p className="text-sm text-[#6b7f92]">暂无家庭成员</p> : null}
        </div>
      </Section>

      <Section title="校外实习或兼职经历" action={<button type="button" onClick={() => setDraft({ ...draft, internshipExperiences: [...draft.internshipExperiences, { startYear: "", endYear: "", company: "", referenceName: "", phone: "" }] })} className="text-sm font-medium text-[#184268]">添加经历</button>}>
        <div className="space-y-3">
          {draft.internshipExperiences.map((item, index) => (
            <div key={index} className="grid gap-3 border border-[#d5e0e9] p-3 sm:grid-cols-3">
              {(["startYear", "endYear", "company", "referenceName", "phone"] as const).map((field) => <Field key={field} label={({ startYear: "起始年", endYear: "结束年", company: "实习公司", referenceName: "证明人", phone: "联系电话" } as const)[field]}><input required={["startYear", "endYear", "company"].includes(field)} type={field.includes("Year") ? "number" : "text"} value={item[field]} onChange={(e) => setDraft((current) => ({ ...current, internshipExperiences: current.internshipExperiences.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: e.target.value } : row) }))} className={inputClass} /></Field>)}
              <button type="button" onClick={() => setDraft({ ...draft, internshipExperiences: draft.internshipExperiences.filter((_, rowIndex) => rowIndex !== index) })} className="justify-self-start text-sm text-[#9d3426]">删除这条</button>
            </div>
          ))}
          {!draft.internshipExperiences.length ? <p className="text-sm text-[#6b7f92]">暂无实习经历</p> : null}
        </div>
      </Section>

      <Section title="补充信息">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="紧急联系人"><input value={draft.emergencyContactName} onChange={(e) => setDraft({ ...draft, emergencyContactName: e.target.value })} className={inputClass} /></Field>
          <Field label="紧急联系电话"><input value={draft.emergencyContactPhone} onChange={(e) => setDraft({ ...draft, emergencyContactPhone: e.target.value })} className={inputClass} /></Field>
          <Field label="关系"><input value={draft.emergencyContactRelation} onChange={(e) => setDraft({ ...draft, emergencyContactRelation: e.target.value })} className={inputClass} /></Field>
          <Field label="身份证复印件和协议"><select value={draft.hasIdCopyAndAgreement === null ? "" : String(draft.hasIdCopyAndAgreement)} onChange={(e) => setDraft({ ...draft, hasIdCopyAndAgreement: e.target.value === "" ? null : e.target.value === "true" })} className={inputClass}><option value="">未填写</option><option value="true">是</option><option value="false">否</option></select></Field>
          <Field label="申请人签名"><input value={draft.applicantSignature} onChange={(e) => setDraft({ ...draft, applicantSignature: e.target.value })} className={inputClass} /></Field>
          <Field label="申请人签署日期"><DatePickerInput value={draft.applicantSignedAt} onChange={(e) => setDraft({ ...draft, applicantSignedAt: e.target.value })} className={inputClass} /></Field>
        </div>
        <Field label="其他说明"><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="mt-1.5 min-h-24 w-full border border-[#b9c9d7] p-3 text-sm outline-none focus:border-[#184268]" /></Field>
      </Section>

      {error ? <p className="text-sm text-[#9d3426]" role="alert">{error}</p> : null}
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#d5e0e9] bg-white py-4">
        <button type="button" onClick={onCancel} className="min-h-11 border border-[#b9c9d7] px-5 text-sm">取消</button>
        <button disabled={isSaving} className="min-h-11 bg-[#184268] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "正在保存..." : "保存登记信息"}</button>
      </div>
    </form>
  );
}
