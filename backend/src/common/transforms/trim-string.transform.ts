import { Transform, type TransformFnParams } from 'class-transformer';

// 在 class-validator 执行前统一去掉文本两端空格。
export function TrimString(): PropertyDecorator {
  return Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    return typeof value === 'string' ? value.trim() : value;
  });
}
