/** Explicit, tab-scoped opt-in to the fictitious demo. Never applies when a real session exists. */
const KEY = "suite-demo-access";
export const enterDemo = () => { try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
export const leaveDemo = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
export const hasDemoAccess = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
/** Gate rule: real user, or signed-out visitor who explicitly opted into the demo. */
export const gateAllows = (o: { user: unknown; isDemo: boolean; demoOptIn: boolean }) => !!o.user || (o.isDemo && o.demoOptIn);
