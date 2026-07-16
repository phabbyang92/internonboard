import { Prop, Schema } from '@nestjs/mongoose';

@Schema()
export abstract class BaseSchema {
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isDeleted!: boolean;

  @Prop({
    type: Date,
    default: null,
    index: true,
  })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}
