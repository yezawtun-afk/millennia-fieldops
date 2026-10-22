// Friendly labels for the activity log. The stored action is deliberately
// machine-readable ("record.approved"); this is what people see.
export const AUDIT_ACTIONS = [
  "record.created",
  "record.approved",
  "record.rejected",
  "record.updated",
  "record.deleted",
  "account.created",
  "account.deleted",
  "account.role",
  "account.activated",
  "account.deactivated",
  "account.pending",
  "account.approved",
  "account.declined",
] as const;

const LABELS: Record<string, string> = {
  "record.created": "Record submitted",
  "record.approved": "Record approved",
  "record.rejected": "Record rejected",
  "record.updated": "Record edited",
  "record.deleted": "Record deleted",
  "account.created": "Account created",
  "account.deleted": "Account deleted",
  "account.role": "Role changed",
  "account.activated": "Account reactivated",
  "account.deactivated": "Account deactivated",
  "account.pending": "Access requested",
  "account.approved": "Access approved",
  "account.declined": "Access declined",
};

export function auditActionLabel(action: string): string {
  return LABELS[action] ?? action;
}

// Colour family for the pill, matching the record status colours.
export function auditTone(action: string): "ok" | "warn" | "danger" | "info" {
  if (action.endsWith(".deleted") || action.endsWith(".declined") || action.endsWith(".deactivated")) {
    return "danger";
  }
  if (action.endsWith(".approved") || action.endsWith(".activated") || action.endsWith(".created")) {
    return "ok";
  }
  if (action.endsWith(".rejected") || action.endsWith(".pending") || action.endsWith(".role")) {
    return "warn";
  }
  return "info";
}
