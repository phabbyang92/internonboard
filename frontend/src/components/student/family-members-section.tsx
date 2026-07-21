import { FormField } from "@/components/student/form-field";
import {
  addButtonClassName,
  inputClassName,
  primaryButtonClassName,
  removeButtonClassName,
} from "@/components/student/form-control-styles";
import type { FamilyMemberDraft } from "@/types/student-form-draft";

interface FamilyMembersSectionProps {
  members: FamilyMemberDraft[];
  onAdd: () => void;
  onUpdate: <Key extends keyof FamilyMemberDraft>(
    index: number,
    key: Key,
    value: FamilyMemberDraft[Key],
  ) => void;
  onRemove: (index: number) => void;
}

export function FamilyMembersSection({
  members,
  onAdd,
  onUpdate,
  onRemove,
}: FamilyMembersSectionProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
      <div className="flex flex-col gap-4 border-b border-[#d2dee8] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-semibold text-[#184268]">03</p>
          <h2 className="mt-2 text-xl font-semibold">家庭成员</h2>
        </div>
        <button
          type="button"
          className={addButtonClassName}
          disabled={members.length >= 10}
          onClick={onAdd}
        >
          + 添加成员
        </button>
      </div>

      {members.length === 0 ? (
        <div className="px-5 py-10 text-center sm:px-8">
          <p className="text-sm text-[#5f7285]">暂无家庭成员</p>
          <button
            type="button"
            className={`${primaryButtonClassName} mt-4`}
            onClick={onAdd}
          >
            添加第一位成员
          </button>
        </div>
      ) : (
        <div>
          {members.map((member, index) => (
            <fieldset
              key={index}
              className="border-b border-[#dee7ee] px-5 py-6 last:border-b-0 sm:px-8"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <legend className="text-sm font-semibold text-[#263746]">
                  家庭成员 {index + 1}
                </legend>
                <button
                  type="button"
                  className={removeButtonClassName}
                  onClick={() => onRemove(index)}
                >
                  删除
                </button>
              </div>

              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  htmlFor={`family-${index}-relation`}
                  label="关系"
                  required
                >
                  <input
                    id={`family-${index}-relation`}
                    className={inputClassName}
                    maxLength={50}
                    required
                    value={member.relation}
                    onChange={(event) =>
                      onUpdate(index, "relation", event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  htmlFor={`family-${index}-name`}
                  label="姓名"
                  required
                >
                  <input
                    id={`family-${index}-name`}
                    className={inputClassName}
                    maxLength={100}
                    required
                    value={member.name}
                    onChange={(event) =>
                      onUpdate(index, "name", event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  htmlFor={`family-${index}-employer`}
                  label="工作单位"
                >
                  <input
                    id={`family-${index}-employer`}
                    className={inputClassName}
                    maxLength={200}
                    value={member.employer}
                    onChange={(event) =>
                      onUpdate(index, "employer", event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  htmlFor={`family-${index}-phone`}
                  label="联系电话"
                >
                  <input
                    id={`family-${index}-phone`}
                    className={inputClassName}
                    type="tel"
                    maxLength={30}
                    value={member.phone}
                    onChange={(event) =>
                      onUpdate(index, "phone", event.target.value)
                    }
                  />
                </FormField>
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
