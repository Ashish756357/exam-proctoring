import { Schema, model, InferSchemaType } from "mongoose";

const proctoringEventSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    examId: { type: String, required: true, index: true },
    candidateId: { type: String, required: true, index: true },
    source: { type: String, enum: ["LAPTOP", "MOBILE", "SYSTEM"], required: true },
    eventType: { type: String, required: true, index: true },
    severity: { type: Number, min: 1, max: 10, required: true },
    timestamp: { type: Date, required: true, index: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    frameRef: { type: String }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export type ProctoringEventDocument = InferSchemaType<typeof proctoringEventSchema>;

export const ProctoringEventModel = model("ProctoringEvent", proctoringEventSchema);
