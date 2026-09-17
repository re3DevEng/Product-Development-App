"use client";
import { useEffect, useState } from "react";
import { readState, type AppState } from "./domain";
import { makeSampleState } from "./seed";

const KEY = "re3d-product-development-demo-v1";
const LOCK = `${KEY}-write`;
export function useWorkspaceStore() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    function refresh() {
      try {
        const raw = localStorage.getItem(KEY);
        setState(raw ? readState(raw) : makeSampleState());
        setError("");
      } catch {
        setState(null);
        setError(
          "Your saved sample data could not be loaded. You can download a recovery copy before resetting it.",
        );
      }
    }
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  async function commit(change: (current: AppState) => AppState) {
    if (!navigator.locks)
      throw new Error(
        "This prototype needs a browser with Web Locks support. Please open it in a current Chrome or Edge browser on localhost.",
      );
    await navigator.locks.request(LOCK, () => {
      const raw = localStorage.getItem(KEY);
      const current = raw ? readState(raw) : (state ?? makeSampleState());
      const next = change(current);
      const saved = JSON.stringify(next);
      readState(saved);
      try {
        localStorage.setItem(KEY, saved);
      } catch {
        throw new Error(
          "This browser could not save the change. Check browser storage permissions and available space.",
        );
      }
      setState(next);
      setError("");
    });
  }
  async function reset() {
    await commit(() => makeSampleState());
  }
  async function recover() {
    if (!navigator.locks)
      throw new Error(
        "Open this prototype in a current Chrome or Edge browser on localhost.",
      );
    await navigator.locks.request(LOCK, () => {
      const next = makeSampleState();
      localStorage.setItem(KEY, JSON.stringify(next));
      setState(next);
      setError("");
    });
  }
  function download(raw = false) {
    const data = raw
      ? (localStorage.getItem(KEY) ?? "{}")
      : JSON.stringify(state, null, 2);
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = raw
      ? "product-development-recovery.json"
      : "product-development-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return { state, error, commit, reset, recover, download };
}
