import { DesignSchema, type DesignDocument } from "./types";

/** Pure, idempotent normalization. Never regenerates furniture or writes storage. */
export function parseDesignDocument(input: unknown): DesignDocument {
  return DesignSchema.parse(input);
}
