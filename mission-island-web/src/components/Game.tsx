"use client";
// Hosts the game. The engine and 3D client are imperative Three.js modules that look up these
// element ids, so the markup is static and the module is loaded once after the first render.
import { useEffect } from "react";
import "@/game/client/game.css";

const MARKUP = `
  <canvas id="gl"></canvas>
  <div id="hud" class="hidden">
    <div id="resources" class="card"></div>
    <div id="quest" class="card"></div>
    <div id="topbar"><div id="players"></div></div>
    <canvas id="minimap" width="190" height="190"></canvas>
    <div id="prompt" class="hidden"></div>
    <div id="help" class="card small"><b>WASD</b> move · <b>Shift</b> run · <b>Drag</b> look · <b>E</b> station · <b>C</b> CAPCOM · <b>Tab</b> next player</div>
    <button id="capcomBtn" class="capbtn">Ask CAPCOM <kbd>C</kbd></button>
  </div>
  <div id="capcom" class="hidden"></div>
  <div id="panel" class="hidden"></div>
  <div id="toast"></div>
  <div id="simui" class="hidden">
    <div id="simtop" class="card"></div>
    <div id="simleft" class="card"></div>
    <div id="simright" class="card"><h3>Mission Log</h3><div id="simlog"></div></div>
    <div id="simbottom" class="card"><canvas id="simchart" width="560" height="120"></canvas><div id="simctl"></div></div>
  </div>
  <div id="surfaceui" class="hidden"></div>
  <div id="modal" class="hidden"></div>
  <div id="screen"></div>`;

export default function Game() {
  useEffect(() => {
    import("@/game/client/main.js"); // module evaluates once, even if the effect runs twice in dev
  }, []);
  return <div dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
