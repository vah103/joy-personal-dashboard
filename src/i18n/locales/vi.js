import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";
import dynamicUi from "./vi-dynamic-ui.js";
import saleFlow from "./vi-sale-flow.js";

export default Object.freeze({ ...core, ...hardening, ...cleanup, ...dynamicUi, ...saleFlow });
