function isBaselineWritingTask(task) {
  return task?.id === "baseline-writing";
}

function isBaselineSpeakingTask(task) {
  return task?.id === "baseline-speaking";
}

function genericTeachingPrompt(task) {
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
    ? "- Use only the assigned STUDY4 or YouPass test below; do not replace it with another source.\n- Do not coach me during the timed test. Wait until I have submitted the full test before reviewing answers.\n- Never reveal or reproduce a third-party answer key before I finish the assigned work.\n- Treat the platform result as diagnostic practice evidence, not an official IELTS score."
    : assignedWriting
      ? "- Use only the assigned STUDY4 or YouPass Writing prompt below; do not replace it with another prompt.\n- Before my original response is complete, do not reveal, reproduce or rely on provider guidance or a model answer.\n- Follow the relevant synchronized knowledge from my external course without replacing the teacher's framework with a conflicting one.\n- Keep my original response unchanged, then evaluate it against all four Writing criteria with uncertainty stated clearly and guide only the targeted rewrite required by the task."
      : "- Follow the task material and instructions exactly.\n- Use synchronized external-course knowledge only when it is relevant to Writing and does not contaminate a test or baseline.";

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

function baselineWritingTeachingPrompt(task) {
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === "writing" || error.skill === "review"))
    .slice(0, 5);
  return `You are administering my unaided IELTS Writing baseline.

Baseline integrity rules:
- Use only the official Writing material attached to the Joy task.
- First ask whether I have already completed BOTH Task 1 and Task 2 under one strict 60-minute sitting.
- If I have not completed them, do not discuss the prompts, plan ideas, explain structures, suggest vocabulary, use my Course notes or help me write. Tell me only to open the official material, write Task 1 in 20 minutes and Task 2 in 40 minutes, then return with both unchanged responses.
- If I have completed them, ask me to paste Task 1 and Task 2 exactly as written.
- Preserve both original responses before any correction.
- Evaluate Task 1 against Task Achievement, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.
- Evaluate Task 2 against Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.
- State that any band estimate is provisional and evidence-based, not an official score.
- Identify no more than five recurring errors and one prevention action for each.
- Do not guide a rewrite until the original baseline assessment is complete.
- At the end, produce a short structured result that can be recorded in Joy.

Current task:
${JSON.stringify({
    id: task.id,
    title: task.title,
    availableMinutes: task.minutes,
    objective: task.objective,
    steps: task.steps,
    material: task.material,
    materialUrl: task.materialUrl,
    output: task.output,
    doneWhen: task.doneWhen,
  }, null, 2)}

Existing recurring Writing errors, for comparison only after scoring:
${JSON.stringify(relevantErrors, null, 2)}

Begin by asking only whether both timed responses are already complete.`;
}

const IELTS_SPEAKING_SOURCE_LIBRARY_URL =
  "/project-data/ielts/speaking-sources.json?v=ielts-speaking-source-catalog-v2";

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
  if (task?.skill !== "speaking" || isBaselineSpeakingTask(task)) return false;
  if (task?.kind === "course" || task?.kind === "review") return false;
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

const loadIeltsSourceLibraryWithoutSpeaking = loadIeltsSourceLibrary;
let ieltsSourceLibraryWithSpeakingPromise = null;
loadIeltsSourceLibrary = async function loadIeltsSourceLibraryWithSpeaking() {
  if (!ieltsSourceLibraryWithSpeakingPromise) {
    ieltsSourceLibraryWithSpeakingPromise = Promise.all([
      loadIeltsSourceLibraryWithoutSpeaking(),
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

const isAssignedSourceTaskWithoutSpeaking = isAssignedSourceTask;
isAssignedSourceTask = function isAssignedSourceTaskWithSpeaking(task) {
  return isAssignedSourceTaskWithoutSpeaking(task) || isSpeakingSourceTask(task);
};

const sourceRequiresFullTestWithoutSpeaking = sourceRequiresFullTest;
sourceRequiresFullTest = function sourceRequiresFullTestWithSpeaking(task) {
  if (task?.skill === "speaking") return speakingTaskPart(task) === "full";
  return sourceRequiresFullTestWithoutSpeaking(task);
};

function safeSpeakingSources(library) {
  return (library.tests || []).filter((test) => (
    test.skill === "speaking"
    && test.questionFlow !== "article-topic-set"
  ));
}

const eligibleSourceTestsWithoutSpeaking = eligibleSourceTests;
eligibleSourceTests = function eligibleSourceTestsWithSpeaking(task, library) {
  if (task?.skill !== "speaking") return eligibleSourceTestsWithoutSpeaking(task, library);

  const requestedPart = speakingTaskPart(task) || "full";
  const candidates = safeSpeakingSources(library);
  let exact = candidates.filter((test) => test.taskPart === requestedPart);

  if (requestedPart === "part1" || requestedPart === "part3") {
    const multiQuestion = exact.filter((test) => test.questionFlow !== "single-question");
    if (multiQuestion.length) exact = multiQuestion;
    else exact = [];
  }
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

const makeSourceAssignmentWithoutSpeaking = makeSourceAssignment;
makeSourceAssignment = function makeSourceAssignmentWithSpeaking(test, library) {
  const assignment = makeSourceAssignmentWithoutSpeaking(test, library);
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

function sourceAdjustedBaselineSpeakingTask(task) {
  return {
    ...task,
    title: "Speaking text-response baseline",
    objective: "Measure immediate idea development, coherence, vocabulary and grammar across Parts 1, 2 and 3 using typed answers. Pronunciation is not assessed and fluency evidence is limited.",
    steps: [
      "Open the attached official IELTS Speaking sample and start with ChatGPT only when you are ready.",
      "Use chat-first mode. ChatGPT asks one official question at a time and never shows future questions, hints or sample answers.",
      "Answer immediately without drafting, translating or using grammar correction before sending.",
      "Complete 4–5 Part 1 questions, one Part 2 cue card after one minute of keyword notes, and 3–4 linked Part 3 questions.",
      "Preserve every original answer before correction, then review content development, coherence, vocabulary, grammar and spoken-style wording.",
      "Record fluency as limited evidence and pronunciation as not assessed; do not create a confident overall Speaking band from typed answers alone.",
    ],
    output: "Official-source typed answers across all three parts, response-time notes and a limited text-response assessment.",
    doneWhen: [
      "All three official Speaking parts are completed in chat-first mode.",
      "Original answers are preserved before correction.",
      "Feedback covers content development, coherence, vocabulary and grammar.",
      "Pronunciation is marked not assessed and fluency is marked limited evidence.",
    ],
  };
}

function sourceAdjustedSpeakingPracticeTask(task, assignment) {
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
      "Start with ChatGPT in chat-first mode. ChatGPT asks only one Part 1 question and waits for your answer.",
      "Answer immediately in one message, normally 2–4 sentences. Do not draft, translate or use grammar correction before sending.",
      "Complete 4–5 original answers before grouped feedback.",
      "Review directness, idea extension, natural spoken wording, vocabulary and grammar. Fluency evidence is limited and pronunciation is not assessed from text.",
      "Re-answer no more than three weak questions once.",
    ];
  } else if (part === "part2") {
    steps = [
      openSource,
      "ChatGPT shows only the assigned cue card, then gives you one minute to note keywords. It must not provide ideas, vocabulary or a model answer first.",
      "Type one immediate long-turn answer in a single message, aiming for roughly 150–220 words. Do not revise it before sending.",
      "Keep the original answer unchanged and review coverage, organisation, spoken-style vocabulary and grammar.",
      "Fluency evidence is limited and pronunciation is not assessed from text.",
      "Produce one improved second attempt only after feedback.",
    ];
  } else if (part === "part3") {
    steps = [
      openSource,
      "ChatGPT asks one assigned Part 3 question at a time and waits for your answer.",
      "Answer immediately in one message, normally 4–7 sentences with a clear position, explanation and example where useful.",
      "Complete 3–4 original answers before grouped feedback. Do not receive model answers between questions.",
      "Review reasoning, coherence, spoken-style vocabulary and grammar. Fluency evidence is limited and pronunciation is not assessed from text.",
      "Re-answer no more than three weak questions once.",
    ];
  } else {
    steps = [
      openSource,
      "Use chat-first mode: ChatGPT asks one question at a time, waits for your immediate typed answer and never requests voice or audio in this version.",
      "Complete 4–5 Part 1 questions before grouped feedback.",
      "For Part 2, view only the cue card, take one minute of keyword notes and send one unchanged 150–220 word answer.",
      "For Part 3, answer 3–4 linked questions one at a time before grouped feedback.",
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

const sourceAdjustedTaskWithoutSpeaking = sourceAdjustedTask;
sourceAdjustedTask = function sourceAdjustedTaskWithSpeaking(
  task,
  assignment = sourceAssignmentFor(task),
) {
  if (isBaselineSpeakingTask(task)) return sourceAdjustedBaselineSpeakingTask(task);
  if (task?.skill === "speaking" && isSpeakingSourceTask(task) && assignment) {
    return sourceAdjustedSpeakingPracticeTask(task, assignment);
  }
  return sourceAdjustedTaskWithoutSpeaking(task, assignment);
};

const rawBaselineTasks = baselineTasks;
baselineTasks = function baselineTasksWithChatFirstSpeaking() {
  return rawBaselineTasks().map((task) => (
    isBaselineSpeakingTask(task) ? sourceAdjustedBaselineSpeakingTask(task) : task
  ));
};

effectiveRhythm = function effectiveRhythmWithoutHiddenBaselineReplacement(rhythm) {
  return rhythm;
};

rhythmTasks = function rhythmTasksWithoutHiddenBaselineReplacement(rhythmId) {
  if (rhythmId === "baseline") return baselineTasks();
  const defaults = staticTasks().filter((task) => task.rhythmId === rhythmId);
  const custom = app.data.customTasks.filter((task) => task.rhythmId === rhythmId);
  if (!custom.length) return defaults;
  return [...defaults.filter((task) => task.kind === "course"), ...custom];
};

const scheduledCurrentContext = currentContext;
currentContext = function currentContextWithPersistentBaselineGate(today = dateKey()) {
  if (!app.program) return scheduledCurrentContext(today);
  const tasks = baselineTasks();
  const remaining = tasks.filter((task) => !isDone(task));
  if (today >= "2026-08-01" && (today <= "2026-08-02" || remaining.length > 0)) {
    const catchUp = today > "2026-08-02";
    return {
      type: "baseline",
      id: "baseline",
      label: catchUp ? "Baseline catch-up · complete before Journey" : "Baseline · 1–2 Aug",
      objective: catchUp
        ? "Complete every unfinished baseline task before beginning the August learning rhythms."
        : app.program.baseline.objective,
      tasks,
      targetMinutes: remaining.reduce((sum, task) => sum + Number(task.minutes || 0), 0),
    };
  }
  return scheduledCurrentContext(today);
};

const taskMaterialLinksWithoutSpeaking = taskMaterialLinks;
taskMaterialLinks = function taskMaterialLinksWithSpeaking(task) {
  if (task?.skill !== "speaking") return taskMaterialLinksWithoutSpeaking(task);
  const assignment = task.sourceAssignment || sourceAssignmentFor(task);
  const direct = externalMaterialLink(
    task.materialUrl,
    assignment ? `Open assigned Speaking set on ${assignment.providerName}` : "Open official Speaking material",
  );
  const fallback = task.materialFallbackUrl && task.materialFallbackUrl !== task.materialUrl
    ? externalMaterialLink(task.materialFallbackUrl, "Open official source page")
    : "";
  if (!direct && !fallback) return "";
  return `<div class="ielts-material-links">${direct}${fallback}</div>`;
};

const sourceAssignmentPanelWithoutSpeaking = sourceAssignmentPanel;
sourceAssignmentPanel = function sourceAssignmentPanelWithSpeaking(
  task,
  assignment,
  sourceError = "",
) {
  if (task?.skill !== "speaking") {
    return sourceAssignmentPanelWithoutSpeaking(task, assignment, sourceError);
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
  const requestedPart = speakingTaskPart(task) || assignment.taskPart;
  const detail = `${speakingPartLabel(requestedPart)}${assignment.topicTags?.length ? ` · ${assignment.topicTags.slice(0, 3).join(", ")}` : ""}`;
  return `
    <div class="ielts-course-note">
      <strong>Speaking set locked to this task</strong>
      <p>${escapeHtml(assignment.providerName)} · ${escapeHtml(assignment.testTitle)} · ${escapeHtml(detail)}</p>
      ${assignment.sectionLabel ? `<p>Open section: ${escapeHtml(assignment.sectionLabel)}</p>` : ""}
      <p>Mode: immediate typed answers, one question at a time.</p>
      ${canChange ? `<button type="button" data-ielts-action="change-source" data-task-id="${escapeHtml(task.id)}">Choose another set</button>` : ""}
    </div>`;
};

const taskDrawerWithoutSpeaking = taskDrawer;
taskDrawer = async function taskDrawerWithSpeaking(task) {
  const result = await taskDrawerWithoutSpeaking(task);
  if (task?.skill !== "speaking") return result;

  const drawer = document.querySelector("#ielts-drawer");
  const chatHint = drawer?.querySelector(".ielts-chatgpt-button small");
  if (chatHint) {
    chatHint.textContent = isBaselineSpeakingTask(task)
      ? "Use the official Speaking sample in chat-first text mode"
      : "Copy the task and assigned Speaking set into ChatGPT";
  }

  const evidence = drawer?.querySelector('textarea[name="evidence"]');
  if (evidence) {
    evidence.placeholder = isBaselineSpeakingTask(task)
      ? "Official source; original typed answers; response-time notes; limited text assessment…"
      : "Provider, set title and URL; original typed answers; response-time notes; text feedback; repeated answers…";
  }
  return result;
};

function speakingTeachingPrompt(task) {
  const baseline = isBaselineSpeakingTask(task);
  const assignment = typeof sourceAssignmentFor === "function" ? sourceAssignmentFor(task) : null;
  const effectiveTask = typeof sourceAdjustedTask === "function"
    ? sourceAdjustedTask(task, assignment)
    : task;
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === "speaking" || error.skill === "review"))
    .slice(0, 5);
  const sourceRule = baseline
    ? "- Use only the official IELTS Speaking material attached to this baseline. Do not replace it with STUDY4, YouPass or a generated question set."
    : "- Use only the assigned STUDY4 or YouPass Speaking source below. Do not silently replace it with another set.";

  return `You are my IELTS Speaking teacher and examiner for a chat-first text-response session.

Interaction mode:
- I will TYPE each answer immediately instead of speaking.
- Do not ask me to use voice, upload audio or record myself in this version.
${sourceRule}
- Open the attached URL when possible. If the page or PDF cannot be read, ask me to paste or screenshot ONLY the current question. Do not ask me to copy the whole question bank.
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

Begin with one short sentence explaining the chat-first rule. Then give me only the first question from the required source, or ask me to paste only that current question if you cannot read it.`;
}

function teachingPrompt(task) {
  if (isBaselineWritingTask(task)) return baselineWritingTeachingPrompt(task);
  if (task?.skill === "speaking") return speakingTeachingPrompt(task);
  return genericTeachingPrompt(task);
}
