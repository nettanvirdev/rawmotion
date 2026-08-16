/**
 * Webpack entry point for the render bundle.
 *
 * `@remotion/bundler` compiles this file; `registerRoot` is what tells the
 * resulting bundle which compositions exist. Keep it to these two lines -
 * anything imported here is imported by every render.
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
