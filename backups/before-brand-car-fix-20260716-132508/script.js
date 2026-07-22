const sidebar = document.querySelector(".sidebar");
const handle = document.querySelector(".resize-handle");
const minSidebarWidth = 210;
const maxSidebarWidth = 420;

function setSidebarWidth(width) {
  const nextWidth = Math.min(maxSidebarWidth, Math.max(minSidebarWidth, width));
  document.documentElement.style.setProperty("--sidebar-width", `${nextWidth}px`);
}

if (sidebar && handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    event.preventDefault();
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;

    function resize(moveEvent) {
      setSidebarWidth(startWidth + moveEvent.clientX - startX);
    }

    function stopResize(upEvent) {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", resize);
      handle.removeEventListener("pointerup", stopResize);
      handle.removeEventListener("pointercancel", stopResize);
    }

    handle.addEventListener("pointermove", resize);
    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".sidebar a[href], .footer a[href]").forEach((link) => {
  const href = link.getAttribute("href");
  const [linkedPage, linkedHash] = href.split("#");

  if (linkedPage === currentPage && (!linkedHash || `#${linkedHash}` === window.location.hash)) {
    link.setAttribute("aria-current", "page");
  }
});

function openDetailsForHash(hash) {
  if (!hash) {
    return;
  }

  const target = document.getElementById(hash.slice(1));
  let current = target;

  while (current) {
    if (current.tagName === "DETAILS") {
      current.open = true;
    }

    current = current.parentElement;
  }
}

document.querySelectorAll(".route-note-link").forEach((link) => {
  link.addEventListener("click", () => {
    openDetailsForHash(link.hash);
  });
});

openDetailsForHash(window.location.hash);
window.addEventListener("hashchange", () => {
  openDetailsForHash(window.location.hash);
});

function readNumber(id) {
  const input = document.getElementById(id);
  return input ? Number(input.value) : Number.NaN;
}

function roundMiles(value) {
  return Math.round(value).toLocaleString();
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function roundKwh(value) {
  return Math.round(value * 10) / 10;
}

function roundMoney(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function conditionAdjustment(speedId, windId) {
  const speed = readNumber(speedId);
  const wind = readNumber(windId);
  const reduction = speed + wind;
  const factor = Math.max(0.4, 1 - reduction / 100);

  return {
    reduction,
    factor,
  };
}

function conditionText(reduction, adjustedRange) {
  if (reduction <= 0) {
    return "No speed or wind/weather reduction was applied.";
  }

  return `The planning range was reduced by ${roundPercent(reduction)}%, giving an adjusted range of about ${roundMiles(adjustedRange)} miles.`;
}

function updateRangeCalculator() {
  const result = document.getElementById("rangeResult");
  if (!result) {
    return;
  }

  const range = readNumber("rangeFull");
  const start = readNumber("startCharge");
  const buffer = readNumber("arrivalBuffer");
  const adjustment = conditionAdjustment("speedAdjustment", "windAdjustment");

  if (range <= 0 || start < 0 || start > 100 || buffer < 0 || buffer > 100 || Number.isNaN(range + start + buffer + adjustment.reduction)) {
    result.classList.add("warning");
    result.innerHTML = "<strong>Check the numbers.</strong>Use a positive range and charge percentages from 0 to 100.";
    return;
  }

  const adjustedRange = range * adjustment.factor;
  const usablePercent = start - buffer;
  const bufferMiles = adjustedRange * (buffer / 100);

  if (usablePercent <= 0) {
    result.classList.add("warning");
    result.innerHTML = `<strong>No driving margin.</strong>Starting at ${roundPercent(start)}% leaves no room for a ${roundPercent(buffer)}% buffer.`;
    return;
  }

  const driveMiles = adjustedRange * (usablePercent / 100);
  result.classList.remove("warning");
  result.innerHTML = `<strong>Plan about ${roundMiles(driveMiles)} miles or less.</strong>That leaves a ${roundPercent(buffer)}% arrival buffer, about ${roundMiles(bufferMiles)} miles of estimated range. ${conditionText(adjustment.reduction, adjustedRange)}`;
}

function updateLegCalculator() {
  const result = document.getElementById("legResult");
  if (!result) {
    return;
  }

  const range = readNumber("legRangeFull");
  const start = readNumber("legStartCharge");
  const miles = readNumber("plannedMiles");
  const buffer = readNumber("legArrivalBuffer");
  const adjustment = conditionAdjustment("legSpeedAdjustment", "legWindAdjustment");

  if (range <= 0 || miles < 0 || start < 0 || start > 100 || buffer < 0 || buffer > 100 || Number.isNaN(range + start + miles + buffer + adjustment.reduction)) {
    result.classList.add("warning");
    result.innerHTML = "<strong>Check the numbers.</strong>Use a positive range, non-negative miles, and charge percentages from 0 to 100.";
    return;
  }

  const adjustedRange = range * adjustment.factor;
  const usedPercent = (miles / adjustedRange) * 100;
  const arrivalPercent = start - usedPercent;
  const marginPercent = arrivalPercent - buffer;
  const arrivalMiles = Math.max(0, adjustedRange * (arrivalPercent / 100));
  const marginMiles = adjustedRange * (marginPercent / 100);
  const adjustmentText = conditionText(adjustment.reduction, adjustedRange);

  if (marginPercent < 0) {
    result.classList.add("warning");
    result.innerHTML = `<strong>This leg may be too long.</strong>Estimated arrival is ${roundPercent(arrivalPercent)}%, about ${roundMiles(arrivalMiles)} miles. That is short of the buffer by about ${roundMiles(Math.abs(marginMiles))} miles. ${adjustmentText}`;
    return;
  }

  result.classList.remove("warning");
  result.innerHTML = `<strong>This leg keeps the buffer.</strong>Estimated arrival is ${roundPercent(arrivalPercent)}%, about ${roundMiles(arrivalMiles)} miles. Buffer margin is about ${roundMiles(marginMiles)} miles. ${adjustmentText}`;
}

function updateHomeCostCalculator() {
  const result = document.getElementById("homeCostResult");
  if (!result) {
    return;
  }

  const miles = readNumber("monthlyMiles");
  const efficiency = readNumber("homeEfficiency");
  const rate = readNumber("homeRate");
  const loss = readNumber("chargingLoss");

  if (miles < 0 || efficiency <= 0 || rate < 0 || loss < 0 || loss >= 100 || Number.isNaN(miles + efficiency + rate + loss)) {
    result.classList.add("warning");
    result.innerHTML = "<strong>Check the numbers.</strong>Use non-negative miles and rate, a positive efficiency, and charging loss below 100%.";
    return;
  }

  const batteryKwh = miles / efficiency;
  const wallKwh = batteryKwh / (1 - loss / 100);
  const monthlyCost = wallKwh * rate;
  const costPer100Miles = (100 / efficiency) / (1 - loss / 100) * rate;

  result.classList.remove("warning");
  result.innerHTML = `<strong>Estimated home charging: ${roundMoney(monthlyCost)} per month.</strong>That uses about ${roundKwh(wallKwh)} kWh from the wall, including a ${roundPercent(loss)}% charging-loss estimate. Cost per 100 miles is about ${roundMoney(costPer100Miles)}.`;
}

function updateSessionCostCalculator() {
  const result = document.getElementById("sessionCostResult");
  if (!result) {
    return;
  }

  const power = readNumber("sessionPower");
  const hours = readNumber("sessionHours");
  const rate = readNumber("sessionRate");
  const efficiency = readNumber("sessionEfficiency");
  const loss = readNumber("sessionLoss");

  if (power <= 0 || hours <= 0 || rate < 0 || efficiency <= 0 || loss < 0 || loss >= 100 || Number.isNaN(power + hours + rate + efficiency + loss)) {
    result.classList.add("warning");
    result.innerHTML = "<strong>Check the numbers.</strong>Use positive charger power, hours, and efficiency, a non-negative rate, and charging loss below 100%.";
    return;
  }

  const wallKwh = power * hours;
  const batteryKwh = wallKwh * (1 - loss / 100);
  const sessionCost = wallKwh * rate;
  const milesAdded = batteryKwh * efficiency;

  result.classList.remove("warning");
  result.innerHTML = `<strong>Estimated session cost: ${roundMoney(sessionCost)}.</strong>That is about ${roundKwh(wallKwh)} kWh from the wall over ${roundPercent(hours)} hours. After a ${roundPercent(loss)}% charging-loss estimate, the battery receives about ${roundKwh(batteryKwh)} kWh, or roughly ${roundMiles(milesAdded)} miles at ${roundPercent(efficiency)} miles per kWh.`;
}

function readText(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : "";
}

function feedbackLine(label, value) {
  return `${label}: ${value || "Not provided"}`;
}

function updateFeedbackNote() {
  const output = document.getElementById("feedbackOutput");
  if (!output) {
    return;
  }

  const lines = [
    "Western EV route/station feedback",
    feedbackLine("Report type", readText("feedbackType")),
    feedbackLine("Route or corridor", readText("feedbackRoute")),
    feedbackLine("Station or stop area", readText("feedbackStation")),
    feedbackLine("Visit date", readText("feedbackDate")),
    feedbackLine("Charger type", readText("feedbackCharger")),
    feedbackLine("Access result", readText("feedbackAccess")),
    feedbackLine("Charging result", readText("feedbackResult")),
    feedbackLine("Recommendation", readText("feedbackRecommendation")),
    "",
    "Traveler notes:",
    readText("feedbackNotes") || "Not provided",
  ];

  output.value = lines.join("\n");
}

document.querySelectorAll("#range-calculator input, #range-calculator select").forEach((input) => {
  input.addEventListener("input", updateRangeCalculator);
  input.addEventListener("change", updateRangeCalculator);
});

document.querySelectorAll("#leg-calculator input, #leg-calculator select").forEach((input) => {
  input.addEventListener("input", updateLegCalculator);
  input.addEventListener("change", updateLegCalculator);
});

document.querySelectorAll("#home-cost-calculator input, #home-cost-calculator select").forEach((input) => {
  input.addEventListener("input", updateHomeCostCalculator);
  input.addEventListener("change", updateHomeCostCalculator);
});

document.querySelectorAll("#session-cost-calculator input, #session-cost-calculator select").forEach((input) => {
  input.addEventListener("input", updateSessionCostCalculator);
  input.addEventListener("change", updateSessionCostCalculator);
});

document.querySelectorAll(".calculator-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
});

const feedbackForm = document.getElementById("feedback-form");
if (feedbackForm) {
  feedbackForm.querySelectorAll("input, select, textarea").forEach((input) => {
    input.addEventListener("input", updateFeedbackNote);
    input.addEventListener("change", updateFeedbackNote);
  });

  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateFeedbackNote();
  });
}

const copyFeedbackButton = document.getElementById("copyFeedbackNote");
if (copyFeedbackButton) {
  copyFeedbackButton.addEventListener("click", async () => {
    const output = document.getElementById("feedbackOutput");
    const status = document.getElementById("feedbackCopyStatus");

    if (!output || !status) {
      return;
    }

    updateFeedbackNote();

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(output.value);
      status.textContent = "Feedback note copied.";
    } catch (error) {
      output.focus();
      output.select();
      const copied = document.execCommand && document.execCommand("copy");
      status.textContent = copied
        ? "Feedback note copied."
        : "Copy did not run automatically. Select the prepared note and copy it manually.";
    }
  });
}

updateRangeCalculator();
updateLegCalculator();
updateHomeCostCalculator();
updateSessionCostCalculator();
updateFeedbackNote();
