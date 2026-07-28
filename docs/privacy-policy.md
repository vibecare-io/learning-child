# Privacy Policy — VibeCare Kids

**Effective date:** 27 July 2026

VibeCare Kids ("Learning Child") is a browser extension that replaces YouTube's
algorithmic recommendations with a parent-curated set of videos. This policy
explains what the extension stores, what it does not collect, and why.

**The short version:** the extension is local-first. Your child's activity
(what they watched, for how long, screen-time usage, the parent PIN) stays on
the device. We do not have a server that receives it, we do not sell it, we run
no advertising, and we run no third-party analytics or tracking.

## What the extension stores, and where

**On your device only** (Chrome local storage — never transmitted to us):

- Watch history: per-video and per-day watch times used for the activity view
  and the daily screen-time limit.
- The reels/Shorts budget and cooldown state.
- Parent settings: the daily screen-time limit, the reels limit and cooldown,
  and the parent PIN that gates the settings.
- A cached copy of the curated catalog so the feed still loads offline.

**Synced across your own Chrome browsers** (Chrome sync storage — handled by
Google under your Google account, not sent to VibeCare):

- Which catalog to load (`catalogUrl`).
- The child profile used to choose a catalog (age band and interests).

If you are signed into Chrome with sync enabled, Google may sync those two items
between your devices, the same way it syncs your bookmarks. This is governed by
Google's privacy policy, not ours.

## What we do not collect

- We do not collect names, email addresses, or any account identifiers.
- We do not transmit your child's watch history, watch times, or screen-time
  usage anywhere. That data never leaves the device.
- We do not use advertising, third-party analytics, or tracking pixels.
- We do not sell or share any data with third parties.

## Network requests the extension makes

To show the curated feed, the extension periodically fetches catalog files (a
list of approved videos and channels, as JSON) from the catalog server you have
configured. The default server is `https://kids.vibecare.io`. These are ordinary
web requests: like any request, they reveal your IP address and standard request
headers to that server, but the extension does not attach any child activity,
watch history, or personal identifiers to them.

The extension runs on `https://www.youtube.com` to build the curated feed. It
reads the page to swap in approved videos; it does not send YouTube page data or
viewing activity to us or to any third party.

## Permissions and why they are needed

- **storage** — to save the local settings, watch history, and catalog cache
  described above.
- **alarms** — to schedule a periodic refresh of the curated catalog so the feed
  stays current.
- **sidePanel** — to show the parent onboarding and settings panel.
- **host access to `www.youtube.com`** — to replace the algorithmic feed with
  curated videos.
- **host access to `kids.vibecare.io`** — to download the curated catalog.

## Children's privacy

The extension is configured by a parent or guardian and is designed so that no
personal information is collected from a child. All child-related data (watch
activity and screen-time usage) is stored locally on the device for the parent's
own use and is never sent to us.

## Data retention and deletion

Watch-history entries older than 90 days are pruned automatically. All stored
data lives in your browser: removing the extension, or clearing the extension's
storage, deletes it. We hold no copy because none is transmitted to us.

## Changes to this policy

If this policy changes, we will update the effective date above and post the new
version at this URL.

## Contact

Questions about this policy: privacy@vibecare.io
