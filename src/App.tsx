/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SandboxedBrowser } from "./components/SandboxedBrowser";

export default function App() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
      <SandboxedBrowser />
    </div>
  );
}
