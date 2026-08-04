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

/*
 * Speaking chat-first extension
 *
 * This remains in the IELTS core bundle so task assignment, drawer rendering and
 * the ChatGPT handoff share the same state and source-locking rules.
 */
const IELTS_SPEAKING_SOURCE_LIBRARY_URL =
  "/project-data/ielts/speaking-sources.json?v=ielts-speaking-source-catalog-v1";

function speakingTaskText(task) {
  return `${task?.id || ""} ${task?.title || ""} ${task?.objective || ""} ${(task?.steps || []).join(" ")}`;
}

function speakingTaskPart(task) {
  const text = speakingTaskText(task);
  const hasPart1 = /\bpart\s*1\b/i.test(text);
  const hasPart2 = /\bpart\s*2\b/i.test(text);
  const hasPart3 = /\bpart\s*3\b/i.test(text);
  if (
    /\b(full|complete|final|baseline|mock)\b[\s\S]{0,30}\bspeaking\b/i.test(text)
    || (hasPart1 && hasPart2 && hasPart3)
    || /all\s+three\s+parts/i.test(text)
  ) return "full";
  if ((hasPart2 && hasPart3) || /part\s*2\s*[-–—+&/]\s*3/i.test(text)) return "part23";
  if (hasPart1) return "part1";
  if (hasPart2) return "part2";
  if (hasPart3) return "part3";
  return "";
}

function isSpeakingSourceTask(task) {
  if (task?.skill !== "speaking") return false;
  if (task?.kind === "course" || task?.kind === "review") return false;
  if (String(task?.id || "").startsWith("baseline-")) return false;
  return Boolean(speakingTaskPart(task))
    || /\b(speaking|answer|response|mock|long turn|cue card)\b/i.test(speakingTaskText(task));
}

function speakingPartLabel(value) {
  if (value === "part1") return "Part 1";
  if (value === "part2") return "Part 2";
  if (value === "part3") return "Part 3";
  if (value === "part23") return "Part 2+3";
  return "Full Speaking";
}

function speakingSourceNoun(task) {
  return task?.skill === "writing" ? "prompt" : task?.skill === "speaking" ? "set" : "test";
}

const loadIeltsSourceLibraryBeforeSpeaking = loadIeltsSourceLibrary;
let ieltsSourceLibraryWithSpeakingPromise = null;
loadIeltsSourceLibrary = async function loadIeltsSourceLibraryWithSpeaking() {
  if (!ieltsSourceLibraryWithSpeakingPromise) {
    ieltsSourceLibraryWithSpeakingPromise = Promise.all([
      loadIeltsSourceLibraryBeforeSpeaking(),
      requestJson(IELTS_SPEAKING_SOURCE_LIBRARY_URL),
    ]).then(([library, speaking]) => {
      const providers = new Map(
        (library.providers || []).map((provider) => [provider.id, { ...provider }]),
      );
      for (const provider of speaking.providers || []) {
        const current = providers.get(provider.id) || {};
        providers.set(provider.id, {
          ...current,
          ...provider,
          availableSkills: [
            ...new Set([...(current.availableSkills || []), ...(provider.availableSkills || [])]),
          ],
          checkedSkills: [...new Set(current.checkedSkills || [])],
        });
      }
      return {
        ...library,
        speakingCatalogVersion: Number(speaking.schemaVersion || 0),
        speakingSelectionPolicy: speaking.selectionPolicy || {},
        providers: [...providers.values()],
        tests: [...(library.tests || []), ...(speaking.tests || [])],
      };
    }).catch((error) => {
      ieltsSourceLibraryWithSpeakingPromise = null;
      throw error;
    });
  }
  return ieltsSourceLibraryWithSpeakingPromise;
};

const isAssignedSourceTaskBeforeSpeaking = isAssignedSourceTask;
isAssignedSourceTask = function isAssignedSourceTaskWithSpeaking(task) {
  return isAssignedSourceTaskBeforeSpeaking(task) || isSpeakingSourceTask(task);
};

const sourceRequiresFullTestBeforeSpeaking = sourceRequiresFullTest;
sourceRequiresFullTest = function sourceRequiresFullTestWithSpeaking(task) {
  if (task?.skill === "speaking") return speakingTaskPart(task) === "full";
  return sourceRequiresFullTestBeforeSpeaking(task);
};

const eligibleSourceTestsBeforeSpeaking = eligibleSourceTests;
eligibleSourceTests = function eligibleSourceTestsWithSpeaking(task, library) {
  if (task?.skill !== "speaking") return eligibleSourceTestsBeforeSpeaking(task, library);

  const requestedPart = speakingTaskPart(task) || "full";
  let candidates = (library.tests || []).filter((test) => test.skill === "speaking");
  const exact = candidates.filter((test) => test.taskPart === requestedPart);
  if (exact.length) return exact;

  if (requestedPart === "part2" || requestedPart === "part3") {
    const linked = candidates.filter((test) => (
      test.taskPart === "part23"
      || (test.taskPart === "full" && (test.speakingParts || []).includes(requestedPart))
    ));
    if (linked.length) return linked;
  }

  if (requestedPart === "part23") {
    const linked = candidates.filter((test) => (
      test.taskPart === "full"
      || ((test.speakingParts || []).includes("part2") && (test.speakingParts || []).includes("part3"))
    ));
    if (linked.length) return linked;
  }

  if (requestedPart === "part1") {
    const linked = candidates.filter((test) => (
      test.taskPart === "full" && (test.speakingParts || []).includes("part1")
    ));
    if (linked.length) return linked;
  }

  return candidates.filter((test) => test.taskPart === "full");
};

const makeSourceAssignmentBeforeSpeaking = makeSourceAssignment;
makeSourceAssignment = function makeSourceAssignmentWithSpeaking(test, library) {
  const assignment = makeSourceAssignmentBeforeSpeaking(test, library);
  if (test.skill !== "speaking") return assignment;
  return {
    ...assignment,
    taskPart: test.taskPart || "full",
    speakingParts: Array.isArray(test.speakingParts) ? [...test.speakingParts] : [],
    topicTags: Array.isArray(test.topicTags) ? [...test.topicTags] : [],
    interactionMode: test.interactionMode || "chat-first",
    questionFlow: test.questionFlow || "provider-set",
  };
};

function sourceAdjustedSpeakingTask(task, assignment) {
  const part = speakingTaskPart(task) || assignment.taskPart || "full";
  const partLabel = speakingPartLabel(part);
  const section = assignment.sectionLabel
    ? ` Use the section labelled “${assignment.sectionLabel}”.`
    : "";
  const openSource = `Open the assigned ${assignment.providerName} Speaking source.${section}`;
  let steps;

  if (part === "part1") {
    steps = [
      openSource,
      "Start with ChatGPT in chat-first mode. ChatGPT must ask only one Part 1 question and wait for your answer.",
      "Answer immediately in one message, normally 2–4 sentences. Do not draft, translate or use grammar correction before sending.",
      "Continue one question at a time. ChatGPT must wait until 4–5 original answers are complete before giving grouped feedback.",
      "Review directness, idea extension, natural spoken wording, vocabulary and grammar. Fluency evidence is limited and pronunciation is not assessed from text.",
      "Re-answer no more than three weak questions once, using the feedback without memorising a model answer.",
    ];
  } else if (part === "part2") {
    steps = [
      openSource,
      "ChatGPT must show only the assigned cue card, then give you one minute to note keywords. It must not provide ideas, vocabulary or a model answer first.",
      "Type one immediate long-turn answer in a single message, aiming for roughly 150–220 words. Do not revise it before sending.",
      "Keep the original answer unchanged and review coverage, organisation, spoken-style vocabulary and grammar.",
      "Fluency evidence is limited and pronunciation is not assessed from text.",
      "Produce one improved second attempt only after feedback.",
    ];
  } else if (part === "part3") {
    steps = [
      openSource,
      "ChatGPT must ask one assigned Part 3 question at a time and wait for your answer.",
      "Answer immediately in one message, normally 4–7 sentences with a clear position, explanation and example where useful.",
      "Complete 3–4 original answers before grouped feedback. Do not receive model answers between questions.",
      "Review reasoning, coherence, spoken-style vocabulary and grammar. Fluency evidence is limited and pronunciation is not assessed from text.",
      "Re-answer no more than three weak questions once.",
    ];
  } else {
    steps = [
      openSource,
      "Use chat-first mode: ChatGPT asks one question at a time, waits for your immediate typed answer and never requests voice or audio in this version.",
      "Complete the assigned Part 1 questions first. Give grouped feedback only after 4–5 original answers.",
      "For Part 2, view only the cue card, take one minute of keyword notes and send one unchanged 150–220 word answer.",
      "For Part 3, answer one question at a time in 4–7 sentences; give grouped feedback after 3–4 original answers.",
      "Assess content development, coherence, vocabulary and grammar. Mark fluency evidence as limited, pronunciation as not assessed, and do not give a confident overall Speaking band from text alone.",
      "Select no more than three weak answers for one improved attempt each.",
    ];
  }

  return {
    ...task,
    material: `${assignment.providerName} · ${assignment.testTitle} · ${partLabel}`,
    materialUrl: assignment.testUrl,
    materialFallbackUrl: "",
    sourceProvider: assignment.providerName,
    sourceAssignment: assignment,
    steps,
    output: "Original typed answers, response-time notes, grouped text feedback and up to three improved answers.",
    doneWhen: [
      "The assigned source and required Speaking part are completed in chat-first mode.",
      "Every original answer is preserved before correction.",
      "Feedback covers content development, coherence, vocabulary and grammar.",
      "Pronunciation is marked not assessed and fluency is marked limited evidence.",
      "No more than three weak answers are repeated.",
    ],
  };
}

const sourceAdjustedTaskBeforeSpeaking = sourceAdjustedTask;
sourceAdjustedTask = function sourceAdjustedTaskWithSpeaking(
  task,
  assignment = sourceAssignmentFor(task),
) {
  if (task?.skill === "speaking" && isSpeakingSourceTask(task) && assignment) {
    return sourceAdjustedSpeakingTask(task, assignment);
  }
  return sourceAdjustedTaskBeforeSpeaking(task, assignment);
};

const taskMaterialLinksBeforeSpeaking = taskMaterialLinks;
taskMaterialLinks = function taskMaterialLinksWithSpeaking(task) {
  if (task?.skill !== "speaking") return taskMaterialLinksBeforeSpeaking(task);
  const assignment = task.sourceAssignment || sourceAssignmentFor(task);
  const direct = externalMaterialLink(
    task.materialUrl,
    assignment ? `Open assigned Speaking set on ${assignment.providerName}` : "Open material",
  );
  return direct ? `<div class="ielts-material-links">${direct}</div>` : "";
};

const sourceAssignmentPanelBeforeSpeaking = sourceAssignmentPanel;
sourceAssignmentPanel = function sourceAssignmentPanelWithSpeaking(
  task,
  assignment,
  sourceError = "",
) {
  if (task?.skill !== "speaking") {
    return sourceAssignmentPanelBeforeSpeaking(task, assignment, sourceError);
  }
  if (!isSpeakingSourceTask(task)) return "";
  if (sourceError) {
    return `
      <div class="ielts-course-note">
        <strong>Joy could not assign a Speaking set.</strong>
        <p>${escapeHtml(sourceError)}</p>
        <button type="button" data-ielts-action="retry-source" data-task-id="${escapeHtml(task.id)}">Try again</button>
      </div>`;
  }
  if (!assignment) return "";
  const state = taskState(task);
  const canChange = !state.status || state.status === "pending";
  const detail = `${speakingPartLabel(assignment.taskPart)}${assignment.topicTags?.length ? ` · ${assignment.topicTags.slice(0, 3).join(", ")}` : ""}`;
  return `
    <div class="ielts-course-note">
      <strong>Speaking set locked to this task</strong>
      <p>${escapeHtml(assignment.providerName)} · ${escapeHtml(assignment.testTitle)} · ${escapeHtml(detail)}</p>
      ${assignment.sectionLabel ? `<p>Open section: ${escapeHtml(assignment.sectionLabel)}</p>` : ""}
      <p>Mode: immediate typed answers, one question at a time.</p>
      ${canChange ? `<button type="button" data-ielts-action="change-source" data-task-id="${escapeHtml(task.id)}">Choose another set</button>` : ""}
    </div>`;
};

const taskDrawerBeforeSpeaking = taskDrawer;
taskDrawer = async function taskDrawerWithSpeaking(task) {
  const result = await taskDrawerBeforeSpeaking(task);
  if (task?.skill !== "speaking" || !isSpeakingSourceTask(task)) return result;

  const drawer = document.querySelector("#ielts-drawer");
  const chatHint = drawer?.querySelector(".ielts-chatgpt-button small");
  if (chatHint) chatHint.textContent = "Copy the task and assigned Speaking set into ChatGPT";

  const evidence = drawer?.querySelector('textarea[name="evidence"]');
  if (evidence) {
    evidence.placeholder =
      "Provider, set title and URL; original typed answers; response-time notes; text feedback; repeated answers…";
  }
  return result;
};

const teachingPromptBeforeSpeaking = teachingPrompt;
teachingPrompt = function teachingPromptWithSpeaking(task) {
  if (task?.skill !== "speaking") return teachingPromptBeforeSpeaking(task);

  const assignment = typeof sourceAssignmentFor === "function" ? sourceAssignmentFor(task) : null;
  const effectiveTask = typeof sourceAdjustedTask === "function"
    ? sourceAdjustedTask(task, assignment)
    : task;
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === "speaking" || error.skill === "review"))
    .slice(0, 5);

  return `You are my IELTS Speaking teacher and examiner for a chat-first practice session.

Interaction mode:
- I will TYPE each answer immediately instead of speaking.
- Do not ask me to use voice, upload audio or record myself in this version.
- Use only the assigned STUDY4 or YouPass Speaking source below. Do not silently replace it with another set.
- Open the assigned URL when possible. If the provider hides the questions behind an interactive page, ask me to paste or screenshot ONLY the current question. Do not ask me to copy the whole question bank.
- Ask exactly one question at a time and wait for my answer.
- Do not show hints, vocabulary, sample answers or corrections before I submit the original answer.
- Treat my first submitted message as the preserved original answer, even when it contains mistakes.
- I should answer promptly without drafting, translating or using grammar correction before sending.

Part rules:
- Part 1: expect 2–4 sentences per answer. Ask 4–5 questions before grouped feedback.
- Part 2: show only the cue card, allow one minute for keyword notes, then expect one unchanged answer of roughly 150–220 words in a single message.
- Part 3: expect 4–7 sentences with a position, explanation and example where useful. Ask 3–4 questions before grouped feedback.
- For a full set, complete Part 1, then Part 2, then the linked Part 3.

Feedback rules:
- Assess directness and content development, coherence, vocabulary, grammar and whether the wording sounds natural for speaking.
- Do not assess pronunciation from text.
- State that fluency evidence is limited because the answers were typed.
- Do not give a confident overall Speaking band from text alone.
- After grouped feedback, select no more than three weak answers for one improved attempt each.
- Do not rewrite every answer into a perfect model. Explain the smallest useful changes first.
- At the end, produce a short structured result that can be recorded in Joy.

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
    sourceAssignment: assignment,
    output: effectiveTask.output,
    doneWhen: effectiveTask.doneWhen,
  }, null, 2)}

Active recurring Speaking errors:
${JSON.stringify(relevantErrors, null, 2)}

Begin with one short sentence explaining the chat-first rule. Then give me only the first assigned question or ask me to paste only that current question if you cannot read it from the provider page.`;
};
