import { persistentAtom } from "@nanostores/persistent";

export const activeSection = persistentAtom<string>("cv:active-section", "About");
