import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Pinpoint Studio Feedback",
  short_name: "Pinpoint",
  version: packageJson.version,
  description: "Pin meticulous design feedback to any page and export it to Notion.",
  permissions: ["storage", "activeTab"],
  host_permissions: ["http://*/*", "https://*/*"],
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  action: {
    default_title: "Pinpoint Studio Feedback",
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
    },
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content.tsx"],
      run_at: "document_idle",
    },
  ],
});
