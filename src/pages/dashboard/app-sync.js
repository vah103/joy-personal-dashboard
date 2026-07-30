async function syncCloudProjects({ silent = false } = {}) {
  if (!CLOUD_BACKEND || !accountSync.connected) return false;

  try {
    const localProjects = state.projects.map(normalizeProject).filter(Boolean);
    if (localProjects.length) {
      await backendRequest("/api/projects/import", {
        method: "POST",
        body: JSON.stringify({ projects: localProjects }),
      });
    }

    for (const id of loadPendingProjectArchives()) {
      try {
        await backendRequest("/api/projects/archive", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
        clearProjectArchive(id);
      } catch (error) {
        if (error.status === 404) clearProjectArchive(id);
        else throw error;
      }
    }

    const payload = await backendRequest("/api/projects");
    state.projects = Array.isArray(payload.projects)
      ? payload.projects.map(normalizeProject).filter((project) => project && !project.archived)
      : [];
    accountSync.projectsReady = true;
    saveState();
    renderProjects();
    return true;
  } catch (error) {
    if (!silent && error.status !== 401) {
      showToast("Projects are offline · changes stay on this device");
    }
    return false;
  }
}

async function syncCloudTasks({ silent = false } = {}) {
  if (!CLOUD_BACKEND) return false;
  try {
    // Existing local tasks are imported once by stable id. D1 keeps its copy authoritative
    // when an id already exists, so an older browser cache cannot undo cloud changes.
    const withoutPendingDeletions = window.JoyTodo?.withoutPendingTaskDeletions;
    const importTasks = typeof withoutPendingDeletions === "function"
      ? withoutPendingDeletions(state.tasks)
      : state.tasks;
    if (importTasks.length) {
      await backendRequest("/api/tasks/import", {
        method: "POST",
        body: JSON.stringify({ tasks: importTasks }),
      });
    }
    for (const id of loadPendingTaskCompletions()) {
      try {
        await backendRequest("/api/tasks/complete", { method: "POST", body: JSON.stringify({ id }) });
        clearTaskCompletion(id);
      } catch (error) {
        if (error.status === 404) clearTaskCompletion(id);
        else throw error;
      }
    }
    const payload = await backendRequest("/api/tasks");
    const cloudTasks = Array.isArray(payload.tasks)
      ? payload.tasks.map(normalizeTask).filter(Boolean)
      : [];
    state.tasks = typeof withoutPendingDeletions === "function"
      ? withoutPendingDeletions(cloudTasks)
      : cloudTasks;
    saveState();
    renderBrief();
    renderTasks();
    renderTaskHistory();
    return true;
  } catch (error) {
    if (!silent && error.status !== 401) showToast("To-do is offline · changes stay on this device");
    return false;
  }
}

function openTaskHistory() {
  renderTaskHistory();
  elements.taskHistoryModal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => elements.taskHistoryModal.querySelector("[data-action='close-task-history']")?.focus(), 0);
}

function closeTaskHistory() {
  elements.taskHistoryModal.hidden = true;
  if (
    elements.modal.hidden
    && elements.salesModal.hidden
    && elements.projectDeleteModal.hidden
  ) document.body.classList.remove("modal-open");
}
