const KEY = "nirikshan.role-intent";

export type RoleIntent = "officer" | "citizen";

export function setRoleIntent(role: RoleIntent) {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* storage unavailable — role defaults to citizen */
  }
}

export function getRoleIntent(): RoleIntent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "officer" || v === "citizen" ? v : null;
  } catch {
    return null;
  }
}
