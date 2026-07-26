chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "adapter-failure") {
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    chrome.action.setBadgeText({ text: "!" });
  }
});
