function teachingPrompt(task) {
  const assignment = typeof sourceAssignmentFor === "function" ? sourceAssignmentFor(task) : null;
  const effectiveTask = typeof sourceAdjustedTask === "function"
    ? sourceAdjustedTask(task, assignment)
    : task;
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === effectiveTask.skill || error.skill === "review"))
    .slice(0, 5);
  const synchronizedCourseKnowledge = relevantCourseTopics(effectiveTask);
  const recentSessions = [...app.data.courseSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const receptivePractice = effectiveTask.skill === "listening" || effectiveTask.skill === "reading";
  const assignedWriting = effectiveTask.skill === "writing" && Boolean(assignment);
  const sourceRules = receptivePractice
    ? "- Use only the assigned STUDY4 or YouPass test below; do not replace it with another source.\n- Never reveal or reproduce a third-party answer key before I finish the assigned work.\n- Treat the platform result as diagnostic practice evidence, not an official IELTS score."
    : assignedWriting
      ? "- Use only the assigned STUDY4 or YouPass Writing prompt below; do not replace it with another prompt.\n- Before my original response is complete, do not reveal, reproduce or rely on provider guidance or a model answer.\n- For Writing, follow the relevant synchronized knowledge from my external course and do not replace the teacher's framework with a conflicting one.\n- Keep my original response unchanged, then evaluate it against all four Writing criteria with uncertainty stated clearly and guide only the targeted rewrite required by the task."
      : "- For Writing, follow the relevant synchronized knowledge from my external course. Do not replace the teacher's framework with a conflicting one.\n- Use advanced grammar only where it is natural for the current task type.";

  return `You are my IELTS teacher. Guide me through the Joy task below step by step.

Important teaching rules:
- Do not give me the entire lesson or all answers at once.
- Start with the first step, wait for my response, then correct me before continuing.
- Adapt the difficulty to my evidence and recurring errors.
${sourceRules}
- At the end, produce a short structured result I can import or record in Joy.

Long-term goal:
- IELTS overall 7.0 by December 2026
- Minimum skill target: 6.5

Current task:
${JSON.stringify({
    id: effectiveTask.id,
    rhythmId: effectiveTask.rhythmId,
    skill: effectiveTask.skill,
    kind: effectiveTask.kind,
    title: effectiveTask.title,
    availableMinutes: effectiveTask.minutes,
    objective: effectiveTask.objective,
    steps: effectiveTask.steps,
    material: effectiveTask.material,
    materialUrl: effectiveTask.materialUrl,
    materialFallbackUrl: effectiveTask.materialFallbackUrl,
    sourceAssignment: assignment,
    output: effectiveTask.output,
    doneWhen: effectiveTask.doneWhen,
  }, null, 2)}

Active recurring errors:
${JSON.stringify(relevantErrors, null, 2)}

Relevant synchronized Writing-course knowledge:
${JSON.stringify(synchronizedCourseKnowledge, null, 2)}

Recent manually imported course sessions:
${JSON.stringify(recentSessions, null, 2)}

Begin by explaining today’s objective in one short paragraph, then give me only Step 1.`;
}
