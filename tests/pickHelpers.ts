import { assertInvariants } from "@/lib/domain/core";
import { currentTask } from "@/lib/domain/waves";
import type { AppState } from "@/lib/domain/types";

export { assertInvariants };
export const currentTaskOf = (s: AppState, waveId: string) => currentTask(s, waveId);
