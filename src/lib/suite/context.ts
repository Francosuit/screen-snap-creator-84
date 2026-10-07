import { createContext } from "react";
// Kept in its own module so editing the store doesn't recreate the context during live reload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SuiteCtx = createContext<any>(null);
