(function registerJoyTaskFocus(root) {
  function create({ elements, request, showMessage, formatFullDateTime, releaseModalLock }) {
    async function open() {
      elements.focusModal.hidden = false;
      document.body.classList.add("modal-open");
      elements.focusNext.textContent = "Checking focus settings…";
      try {
        const payload = await request("/api/focus-reminder");
        const focus = payload.focus || {};
        elements.focusEnabled.checked = Boolean(focus.enabled);
        elements.focusMessage.value = focus.message || "Stay focused";
        elements.focusStart.value = focus.startTime || "08:00";
        elements.focusEnd.value = focus.endTime || "23:30";
        elements.focusMin.value = Number(focus.minMinutes || 60);
        elements.focusMax.value = Number(focus.maxMinutes || 180);
        elements.focusNext.textContent = focus.enabled && focus.nextAt
          ? `Next reminder: ${formatFullDateTime(Date.parse(focus.nextAt))}`
          : "Focus reminders are off.";
        elements.focusButton.classList.toggle("active", Boolean(focus.enabled));
      } catch {
        elements.focusNext.textContent = "Focus settings are temporarily unavailable.";
      }
    }

    function close() {
      elements.focusModal.hidden = true;
      releaseModalLock();
    }

    async function save(event) {
      event.preventDefault();
      const minMinutes = Number(elements.focusMin.value);
      const maxMinutes = Number(elements.focusMax.value);
      if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes) || maxMinutes < minMinutes) {
        return showMessage("Max minutes must be greater than min minutes");
      }
      try {
        const payload = await request("/api/focus-reminder", {
          method: "PUT",
          body: JSON.stringify({
            enabled: elements.focusEnabled.checked,
            message: elements.focusMessage.value.trim() || "Stay focused",
            startTime: elements.focusStart.value,
            endTime: elements.focusEnd.value,
            minMinutes,
            maxMinutes,
          }),
        });
        elements.focusButton.classList.toggle("active", Boolean(payload.focus?.enabled));
        showMessage(payload.focus?.enabled ? "Focus reminders are on" : "Focus reminders are off");
        close();
      } catch {
        showMessage("Focus settings could not be saved");
      }
    }

    return Object.freeze({ open, close, save });
  }

  root.JoyTaskFocus = Object.freeze({ create });
})(window);
