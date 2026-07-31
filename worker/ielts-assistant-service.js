import {
  IELTS_ASSISTANT_SERVICE,
  getIeltsTeachingTask,
} from "./ielts-assistant.js";
import { mutateIeltsState } from "./ielts-core.js";

async function startTask(env, context, taskId, input = {}, dependencies = {}) {
  await getIeltsTeachingTask(env, context, taskId, input, dependencies);
  const mutateState = dependencies.mutateState || mutateIeltsState;
  const result = await mutateState(context.userEmail, env, (data) => {
    const current = data.taskStates?.[taskId] || {};
    if (current.status !== "completed") {
      data.taskStates[taskId] = {
        ...current,
        status: "progress",
        startedAt: Number(current.startedAt || Date.now()),
        updatedAt: Date.now(),
      };
    }
    return data;
  });
  return {
    ok: true,
    taskId,
    state: result.data.taskStates?.[taskId] || {},
    stateVersion: result.version,
  };
}

export const STABLE_IELTS_ASSISTANT_SERVICE = Object.freeze({
  ...IELTS_ASSISTANT_SERVICE,
  startTask,
});
