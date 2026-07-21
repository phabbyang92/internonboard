import { FormField } from "@/components/student/form-field";
import {
  addButtonClassName,
  inputClassName,
  primaryButtonClassName,
  removeButtonClassName,
} from "@/components/student/form-control-styles";
import type { InternshipExperienceDraft } from "@/types/student-form-draft";

interface InternshipExperiencesSectionProps {
  experiences: InternshipExperienceDraft[];
  onAdd: () => void;
  onUpdate: <Key extends keyof InternshipExperienceDraft>(
    index: number,
    key: Key,
    value: InternshipExperienceDraft[Key],
  ) => void;
  onRemove: (index: number) => void;
}

export function InternshipExperiencesSection({
  experiences,
  onAdd,
  onUpdate,
  onRemove,
}: InternshipExperiencesSectionProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-[#d2dee8] bg-white shadow-[0_3px_14px_rgba(24,66,104,0.04)]">
      <div className="flex flex-col gap-4 border-b border-[#d2dee8] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-semibold text-[#184268]">04</p>
          <h2 className="mt-2 text-xl font-semibold">校外实习或兼职经历</h2>
        </div>
        <button
          type="button"
          className={addButtonClassName}
          disabled={experiences.length >= 20}
          onClick={onAdd}
        >
          + 添加经历
        </button>
      </div>

      {experiences.length === 0 ? (
        <div className="px-5 py-10 text-center sm:px-8">
          <p className="text-sm text-[#5f7285]">暂无校外实习或兼职经历</p>
          <button
            type="button"
            className={`${primaryButtonClassName} mt-4`}
            onClick={onAdd}
          >
            添加第一条经历
          </button>
        </div>
      ) : (
        <div>
          {experiences.map((experience, index) => {
            const hasInvalidYearRange =
              experience.startYear !== "" &&
              experience.endYear !== "" &&
              Number(experience.endYear) < Number(experience.startYear);

            return (
              <fieldset
                key={index}
                className="border-b border-[#dee7ee] px-5 py-6 last:border-b-0 sm:px-8"
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <legend className="text-sm font-semibold text-[#263746]">
                    实习或兼职经历 {index + 1}
                  </legend>
                  <button
                    type="button"
                    className={removeButtonClassName}
                    onClick={() => onRemove(index)}
                  >
                    删除
                  </button>
                </div>

                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
                  <FormField
                    htmlFor={`internship-${index}-start-year`}
                    label="起始年份"
                    required
                  >
                    <input
                      id={`internship-${index}-start-year`}
                      className={inputClassName}
                      type="number"
                      inputMode="numeric"
                      min={1900}
                      max={2100}
                      required
                      value={experience.startYear}
                      onChange={(event) =>
                        onUpdate(index, "startYear", event.target.value)
                      }
                    />
                  </FormField>

                  <FormField
                    htmlFor={`internship-${index}-end-year`}
                    label="结束年份"
                    required
                  >
                    <input
                      id={`internship-${index}-end-year`}
                      className={inputClassName}
                      type="number"
                      inputMode="numeric"
                      min={experience.startYear || 1900}
                      max={2100}
                      required
                      aria-invalid={hasInvalidYearRange}
                      aria-describedby={
                        hasInvalidYearRange
                          ? `internship-${index}-year-error`
                          : undefined
                      }
                      value={experience.endYear}
                      onChange={(event) =>
                        onUpdate(index, "endYear", event.target.value)
                      }
                    />
                    {hasInvalidYearRange ? (
                      <p
                        id={`internship-${index}-year-error`}
                        className="mt-2 text-xs text-[#b44532]"
                      >
                        结束年份不能早于起始年份
                      </p>
                    ) : null}
                  </FormField>

                  <FormField
                    htmlFor={`internship-${index}-company`}
                    label="实习公司"
                    required
                    className="lg:col-span-1"
                  >
                    <input
                      id={`internship-${index}-company`}
                      className={inputClassName}
                      maxLength={200}
                      required
                      value={experience.company}
                      onChange={(event) =>
                        onUpdate(index, "company", event.target.value)
                      }
                    />
                  </FormField>

                  <FormField
                    htmlFor={`internship-${index}-reference-name`}
                    label="证明人"
                  >
                    <input
                      id={`internship-${index}-reference-name`}
                      className={inputClassName}
                      maxLength={100}
                      value={experience.referenceName}
                      onChange={(event) =>
                        onUpdate(index, "referenceName", event.target.value)
                      }
                    />
                  </FormField>

                  <FormField
                    htmlFor={`internship-${index}-phone`}
                    label="联系电话"
                  >
                    <input
                      id={`internship-${index}-phone`}
                      className={inputClassName}
                      type="tel"
                      maxLength={30}
                      value={experience.phone}
                      onChange={(event) =>
                        onUpdate(index, "phone", event.target.value)
                      }
                    />
                  </FormField>
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </section>
  );
}
