const STEP_SELECTOR = "check-step[data-log-url]";
const HEADER_SELECTOR = 'summary.CheckStep-header[data-target="check-step.header"]';
const HEADER_ROW_SELECTOR = ".d-flex.flex-items-center";
const DURATION_SELECTOR = ".text-mono.text-normal.text-small.float-right";
const LOG_CONTAINER_SELECTOR = ".js-checks-log-display-container";
const LOG_ERROR_SELECTOR = ".js-checks-log-display-error:not([hidden])";
const LOG_LINE_SELECTOR = ".js-check-step-line";
const LOG_CONTENT_SELECTOR = ".js-check-line-content";
const BUTTON_SELECTOR = "[data-gha-copy-button]";
const COPY_BUTTON_LABEL = "Copy step log";
const COPY_RESET_DELAY_MS = 1800;
const JOB_ROUTE_RE = /^\/[^/]+\/[^/]+\/actions\/runs\/[^/]+\/job\/[^/]+\/?$/;

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>';

let scanTimer = 0;
let mutationObserver;
const resetTimers = new WeakMap();

function isJobLogPage() {
  return JOB_ROUTE_RE.test(window.location.pathname);
}

function createCopyButton() {
  const button = document.createElement("button");
  const label = document.createElement("span");

  button.type = "button";
  button.className = "gha-copy-step-button";
  button.dataset.ghaCopyButton = "true";
  button.dataset.state = "idle";
  button.title = COPY_BUTTON_LABEL;
  button.setAttribute("aria-label", COPY_BUTTON_LABEL);
  button.innerHTML = COPY_ICON_SVG;

  label.className = "gha-copy-step-button-label";
  label.textContent = COPY_BUTTON_LABEL;
  button.append(label);
  button.addEventListener("click", handleCopyButtonClick);

  return button;
}

function scanAndInject() {
  if (!isJobLogPage()) {
    return;
  }

  for (const step of document.querySelectorAll(STEP_SELECTOR)) {
    const header = step.querySelector(HEADER_SELECTOR);
    if (!header || header.querySelector(BUTTON_SELECTOR)) {
      continue;
    }

    const headerRow = header.querySelector(HEADER_ROW_SELECTOR);
    if (!headerRow) {
      continue;
    }

    const button = createCopyButton();
    const duration = headerRow.querySelector(DURATION_SELECTOR);

    if (duration) {
      duration.before(button);
    } else {
      headerRow.append(button);
    }
  }
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(scanAndInject, 60);
}

function setButtonState(button, state) {
  button.dataset.state = state;
  button.disabled = state === "loading";

  if (state === "idle") {
    button.title = COPY_BUTTON_LABEL;
    button.setAttribute("aria-label", COPY_BUTTON_LABEL);
    return;
  }

  const stateLabel =
    state === "success"
      ? "Copied step log"
      : state === "error"
        ? "Failed to copy step log"
        : "Copying step log";

  button.title = stateLabel;
  button.setAttribute("aria-label", stateLabel);
}

function scheduleButtonReset(button) {
  const existingTimer = resetTimers.get(button);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    setButtonState(button, "idle");
    resetTimers.delete(button);
  }, COPY_RESET_DELAY_MS);

  resetTimers.set(button, timer);
}

async function handleCopyButtonClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const step = button.closest(STEP_SELECTOR);

  if (!step || button.disabled) {
    return;
  }

  setButtonState(button, "loading");

  try {
    await ensureStepExpanded(step);

    const logText = await getStepLogText(step);
    if (!logText) {
      throw new Error("No log lines found for step");
    }

    await navigator.clipboard.writeText(logText);
    setButtonState(button, "success");
  } catch (error) {
    console.error("GHA Step Copy: failed to copy step log", error);
    setButtonState(button, "error");
  }

  scheduleButtonReset(button);
}

function isStepExpanded(step) {
  const details = step.querySelector("details");
  return Boolean(details?.open);
}

async function ensureStepExpanded(step) {
  if (!isStepExpanded(step)) {
    const summary = step.querySelector(HEADER_SELECTOR);
    summary?.click();
    await waitFor(() => isStepExpanded(step), 1200);
  }

  try {
    await waitFor(() => hasRenderedStepContent(step), 2500);
  } catch {
    // Expansion still helps the user even if the page is slow to populate content.
  }
}

function hasRenderedStepContent(step) {
  return Boolean(step.querySelector(LOG_LINE_SELECTOR) || step.querySelector(LOG_ERROR_SELECTOR));
}

async function getStepLogText(step) {
  try {
    const fetchedText = await fetchStepLogText(step);
    if (fetchedText) {
      return fetchedText;
    }
  } catch (error) {
    console.warn("GHA Step Copy: step log fetch failed, falling back to rendered DOM", error);
  }

  return readRenderedStepLogText(step);
}

async function fetchStepLogText(step) {
  const relativeLogUrl = step.getAttribute("data-log-url");
  if (!relativeLogUrl) {
    return "";
  }

  const response = await fetch(new URL(relativeLogUrl, window.location.origin), {
    credentials: "include",
    headers: {
      Accept: "text/html, text/plain;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub step log fetch returned ${response.status}`);
  }

  const responseText = await response.text();
  return extractFetchedLogText(responseText);
}

function extractFetchedLogText(markup) {
  if (!markup) {
    return "";
  }

  if (!markup.includes("<")) {
    return normalizeCopiedText(markup);
  }

  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const collectedLines = collectLogLines(parsed);
  if (collectedLines) {
    return collectedLines;
  }

  return "";
}

function readRenderedStepLogText(step) {
  const container = step.querySelector(LOG_CONTAINER_SELECTOR);
  if (!container) {
    return "";
  }

  return collectLogLines(container);
}

function collectLogLines(root) {
  const lines = [];

  for (const line of root.querySelectorAll(LOG_LINE_SELECTOR)) {
    const content = line.querySelector(LOG_CONTENT_SELECTOR);
    if (!content) {
      continue;
    }

    lines.push(readLogLineText(content));
  }

  if (!lines.length) {
    return "";
  }

  return normalizeCopiedText(lines.join("\n"));
}

function normalizeLineText(text) {
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\u200b/g, "");
}

function readLogLineText(node) {
  const text = normalizeLineText(node.innerText || node.textContent || "");

  // GitHub wraps log line fragments in nested spans/details that often contribute
  // surrounding newlines in the HTML fragment. Trim only newline edges so we keep
  // intentional indentation inside the log line itself.
  return text.replace(/^\n+|\n+$/g, "");
}

function normalizeCopiedText(text) {
  return normalizeLineText(text).replace(/^\n+|\n+$/g, "");
}

function waitFor(predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function check() {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Timed out waiting for GitHub Actions step content"));
        return;
      }

      window.setTimeout(check, 50);
    }

    check();
  });
}

function startObserver() {
  if (mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length || mutation.removedNodes.length) {
        scheduleScan();
        break;
      }
    }
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function start() {
  scheduleScan();
  startObserver();

  document.addEventListener("turbo:load", scheduleScan);
  document.addEventListener("soft-nav:render", scheduleScan);
}

start();
