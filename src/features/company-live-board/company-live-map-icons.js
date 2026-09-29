export function companyMapIcon(icon) {
  const shapes = {
    director: '<path d="M4 9l3 2 5-6 5 6 3-2-1 9H5L4 9Z"/><path d="M6 21h12"/>',
    secretary: '<path d="M7 3h8l3 3v15H7z"/><path d="M15 3v4h4M10 11h5M10 15h5"/>',
    project: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    method: '<path d="M9 18h6M10 21h4"/><path d="M9 15a6 6 0 1 1 6 0c-.8.6-1 1.2-1 2h-4c0-.8-.2-1.4-1-2Z"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    chart: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/>',
    qa: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    publication: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v5h5M9 13h6M9 17h4"/>',
    calendar: '<path d="M4 6h16v14H4zM7 3v6M17 3v6M4 10h16"/>',
    policy: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/>',
    server: '<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    integration: '<path d="M9 15l-3 3a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M15 9l3-3a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0M8 12h8"/>',
    generic: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>',
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (shapes[icon] || shapes.generic) + '</svg>';
}
