export async function saleApi(path, options = {}) {
  const { body, headers = {}, ...requestOptions } = options;
  const requestHeaders = { Accept: "application/json", ...headers };
  const plainJsonBody = body !== null
    && typeof body === "object"
    && (Array.isArray(body) || Object.getPrototypeOf(body) === Object.prototype);

  const response = await fetch(path, {
    credentials: "same-origin",
    ...requestOptions,
    headers: plainJsonBody && !Object.keys(requestHeaders).some((name) => name.toLowerCase() === "content-type")
      ? { ...requestHeaders, "Content-Type": "application/json" }
      : requestHeaders,
    ...(body === undefined ? {} : { body: plainJsonBody ? JSON.stringify(body) : body }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || "REQUEST_FAILED"), {
      code: payload.error || "REQUEST_FAILED",
      status: response.status,
      payload,
    });
  }
  return payload;
}
