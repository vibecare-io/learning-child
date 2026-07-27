import { getPrefs, setPrefs } from "../prefs";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $all = <T extends HTMLElement = HTMLElement>(sel: string) =>
  Array.from(document.querySelectorAll(sel)) as T[];

const STEPS = ["#step0", "#step1", "#step2"];
let current = 0;

const state = {
  profile: "",
  interests: [] as string[],
  screenTimeMinutes: null as number | null,
};

const backBtn = $<HTMLButtonElement>("#back");
const nextBtn = $<HTMLButtonElement>("#next");
const finishBtn = $<HTMLButtonElement>("#finish");

function render(): void {
  STEPS.forEach((sel, i) => ($(sel).hidden = i !== current));
  $("#done").hidden = true;
  $("#nav").hidden = false;
  $all(".dot").forEach((d, i) => d.classList.toggle("on", i <= current));
  backBtn.hidden = current === 0;
  nextBtn.hidden = current === STEPS.length - 1;
  finishBtn.hidden = current !== STEPS.length - 1;
  nextBtn.textContent = current === 0 ? "Get started" : "Next";
}

function canAdvance(): boolean {
  if (current === 1 && !state.profile) {
    $("#ages").animate(
      [{ transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
      { duration: 180 },
    );
    return false;
  }
  return true;
}

// Age profile (single select)
$all<HTMLButtonElement>("#ages .choice").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.profile = btn.dataset.profile ?? "";
    $all("#ages .choice").forEach((b) => b.classList.toggle("on", b === btn));
  }),
);

// Interests (multi select)
$all<HTMLButtonElement>("#interests .chip").forEach((btn) =>
  btn.addEventListener("click", () => {
    const id = btn.dataset.interest ?? "";
    const at = state.interests.indexOf(id);
    if (at >= 0) state.interests.splice(at, 1);
    else state.interests.push(id);
    btn.classList.toggle("on");
  }),
);

// Screen time (single select)
$all<HTMLButtonElement>("#screentime .chip").forEach((btn) =>
  btn.addEventListener("click", () => {
    const raw = btn.dataset.min ?? "";
    state.screenTimeMinutes = raw === "" ? null : Number(raw);
    $all("#screentime .chip").forEach((b) => b.classList.toggle("on", b === btn));
  }),
);

nextBtn.addEventListener("click", () => {
  if (canAdvance()) {
    current++;
    render();
  }
});
backBtn.addEventListener("click", () => {
  current--;
  render();
});
finishBtn.addEventListener("click", () => void finish());

$("#google").addEventListener("click", () => {
  $(".fine").textContent = "Google sign-in is coming soon. Continue below to finish setup.";
});
$("#open").addEventListener("click", () => {
  location.href = "https://www.youtube.com/";
});

async function finish(): Promise<void> {
  finishBtn.setAttribute("disabled", "");
  await setPrefs({
    profile: state.profile || "little",
    interests: state.interests,
    screenTimeMinutes: state.screenTimeMinutes,
    auth: null,
    onboarded: true,
  });
  STEPS.forEach((sel) => ($(sel).hidden = true));
  $("#nav").hidden = true;
  $("#done").hidden = false;
  $all(".dot").forEach((d) => d.classList.add("on"));
}

async function init(): Promise<void> {
  const prefs = await getPrefs();
  // Only pre-select the age if they've been through onboarding before.
  state.profile = prefs.onboarded ? prefs.profile : "";
  state.interests = [...prefs.interests];
  state.screenTimeMinutes = prefs.screenTimeMinutes;

  if (state.profile) {
    $all<HTMLButtonElement>("#ages .choice").forEach((b) =>
      b.classList.toggle("on", b.dataset.profile === state.profile),
    );
  }
  $all<HTMLButtonElement>("#interests .chip").forEach((b) =>
    b.classList.toggle("on", state.interests.includes(b.dataset.interest ?? "")),
  );
  $all<HTMLButtonElement>("#screentime .chip").forEach((b) => {
    const raw = b.dataset.min ?? "";
    const val = raw === "" ? null : Number(raw);
    b.classList.toggle("on", val === state.screenTimeMinutes);
  });

  render();
}

void init();
