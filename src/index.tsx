/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";

import { startEngine } from "~/lib/engine";
startEngine();

const root = document.getElementById("root");

render(() => <App />, root!);
