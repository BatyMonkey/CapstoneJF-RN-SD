import {
  findClosestIonContent,
  scrollToTop
} from "./chunk-IPTCXVMI.js";
import {
  componentOnReady
} from "./chunk-RPVHMIOS.js";
import {
  readTask,
  writeTask
} from "./chunk-NLF736SX.js";
import {
  __async
} from "./chunk-QXFS4N4X.js";

// node_modules/@ionic/core/dist/esm/status-tap-pATNXEtr.js
var startStatusTap = () => {
  const win = window;
  win.addEventListener("statusTap", () => {
    readTask(() => {
      const width = win.innerWidth;
      const height = win.innerHeight;
      const el = document.elementFromPoint(width / 2, height / 2);
      if (!el) {
        return;
      }
      const contentEl = findClosestIonContent(el);
      if (contentEl) {
        new Promise((resolve) => componentOnReady(contentEl, resolve)).then(() => {
          writeTask(() => __async(null, null, function* () {
            contentEl.style.setProperty("--overflow", "hidden");
            yield scrollToTop(contentEl, 300);
            contentEl.style.removeProperty("--overflow");
          }));
        });
      }
    });
  });
};
export {
  startStatusTap
};
/*! Bundled license information:

@ionic/core/dist/esm/status-tap-pATNXEtr.js:
  (*!
   * (C) Ionic http://ionicframework.com - MIT License
   *)
*/
//# sourceMappingURL=status-tap-pATNXEtr-EY4RE7A4.js.map
