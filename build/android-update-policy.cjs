const DOWNLOAD_URL = 'https://github.com/vitorrcruzz/biblioteca-digital/releases/latest/download/biblioteca-digital.apk';
const REMIND_AFTER = 24 * 60 * 60 * 1000;
function updateOffer(policy, installedBuild, dismissedAt, now = Date.now()) {
  if (!policy || policy.enabled !== true || !Number.isSafeInteger(policy.latestBuild) || policy.latestBuild < 1 ||
      typeof policy.latestVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(policy.latestVersion) ||
      policy.downloadUrl !== DOWNLOAD_URL || typeof policy.message !== 'string' || policy.message.length > 600) return null;
  if (installedBuild === null) {
    if (policy.notifyLegacy !== true) return null;
  } else if (!Number.isSafeInteger(installedBuild) || installedBuild < 1 || installedBuild >= policy.latestBuild) return null;
  if (Number.isFinite(dismissedAt) && dismissedAt > 0 && now >= dismissedAt && now - dismissedAt < REMIND_AFTER) return null;
  return { version: policy.latestVersion, message: policy.message, url: DOWNLOAD_URL };
}
module.exports = { updateOffer, REMIND_AFTER };
