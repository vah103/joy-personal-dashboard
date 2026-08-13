import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";

export default Object.freeze({ ...core, ...hardening, ...cleanup });
