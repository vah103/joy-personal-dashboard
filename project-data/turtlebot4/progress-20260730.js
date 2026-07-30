(() => {
  window.JoyTurtleBotProgressUpdate = Object.freeze({
    updatedAt: "2026-07-30",
    overallProgress: 32,
    currentStageId: "stage-4",
    currentStageName: "Simulation & Scenarios",
    currentStageStatus: "not-started",
    completedStageIds: ["stage-1", "stage-2", "stage-3"],
    historyEntry: {
      date: "2026-07-30",
      progressAfter: 32,
      title: "Stage 3 navigation benchmark completed",
      detail: "The real TurtleBot4 completed 12/12 fixed Nav2 trials with 100% success and zero recoveries."
    },
    stage3Result: {
      trials: 12,
      successes: 12,
      successRate: 100,
      recoveries: 0,
      meanTravelTimeSeconds: 8.43,
      meanPathLengthMeters: 1.72,
      rosbagMessages: 43542
    }
  });
})();
